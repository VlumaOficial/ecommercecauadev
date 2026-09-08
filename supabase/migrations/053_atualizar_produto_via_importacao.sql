-- =====================================================
-- Frente A (Gestão de Catálogo em Escala), incremento 4 - atualização
-- em massa de produtos via reimportação. Desenho aprovado pelo PO em
-- 08/09/2026 (ver ESCOPO_PROJETO.md §4 e REGRAS_DE_NEGOCIO.md §28).
--
-- Por que uma função NOVA, e não reaproveitar atualizar_produto_com_
-- variacoes (017/019/022/025/027, usada pelo form manual de edição):
-- aquela tem semântica de SINCRONIZAÇÃO DA LISTA INTEIRA de variações
-- (toda variação ativa que não aparece no payload é desativada) - uma
-- planilha de reimportação pode trazer só ALGUMAS das variações de um
-- produto (o lojista só queria atualizar o preço de 1 SKU, por
-- exemplo) - sincronizar a lista inteira desativaria por engano todas
-- as OUTRAS variações do mesmo produto que não estavam naquela
-- planilha. Esta função nova NUNCA toca em variação que não veio no
-- payload - só atualiza os SKUs explicitamente informados.
--
-- Casamento por CHAVE IMUTÁVEL: código do produto (p_codigo) + SKU de
-- cada variação - nenhum dos dois é alterável por esta função (só
-- usados em WHERE/comparação, nunca em SET). Código não encontrado =
-- erro (esta função não cria produto novo - isso é o incremento 1).
--
-- "Célula em branco = não mexe" (nome/descrição/preço/promocional):
-- o client converte toda célula vazia da planilha em `null` no JSON
-- antes de enviar - coalesce(nullif(valor, ''), atual) trata tanto
-- null quanto '' da mesma forma seguro, então o campo nunca é
-- sobrescrito por engano com uma string vazia. Limitação aceita e
-- registrada com o PO: não dá pra LIMPAR um preço promocional já
-- existente por esta via (branco preserva o que já está lá) - pra
-- isso o lojista edita o produto individualmente.
--
-- Estoque é o único campo que NUNCA sobrescreve - o valor da planilha
-- (p_variacoes[].estoque_entrada) é tratado como ENTRADA (positivo)
-- ou SAÍDA (negativo, decisão do PO em 08/09/2026) somada/subtraída
-- do saldo atual via registrar_movimentacao_estoque (021) - CHAMADA
-- DE DENTRO desta mesma função, então fica na MESMA transação (se
-- qualquer coisa depois falhar, a movimentação de estoque também é
-- desfeita - atomicidade real de dados+estoque juntos, não só dados).
-- O guarda de "saldo insuficiente" já existente em
-- registrar_movimentacao_estoque protege uma saída que zeraria/
-- negativaria o estoque - a linha inteira (e o produto inteiro,
-- atomicidade por produto) é revertida nesse caso.
--
-- Fora do escopo desta função (tratado no Route Handler que a chama,
-- fora da transação): acao_foto=remover - Postgres não fala com o
-- Storage do Supabase, então a remoção de foto roda depois, só se
-- esta função tiver sucesso, reaproveitando a rota de exclusão já
-- corrigida (verificação real do retorno do storage.remove(), +
-- policy de SELECT da migration 052).
-- =====================================================

create or replace function public.atualizar_produto_via_importacao(
  p_codigo text,
  -- {"nome": text|null, "descricao": text|null} - null/'' = não mexe
  p_produto jsonb,
  -- [{"sku": text, "preco": numeric|null, "preco_promocional": numeric|null, "estoque_entrada": integer|null}]
  p_variacoes jsonb
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produto public.products;
  v_item jsonb;
  v_sku text;
  v_variant_id uuid;
  v_variant_product_id uuid;
  v_entrada integer;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  select * into v_produto
  from public.products
  where codigo = p_codigo and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'Produto com código "%" não encontrado — a atualização não cria produtos novos.', p_codigo;
  end if;

  if p_variacoes is null or jsonb_array_length(p_variacoes) = 0 then
    raise exception 'Nenhuma variação informada para atualizar.';
  end if;

  -- ---------- dados do produto (código NUNCA entra aqui - imutável) ----------
  update public.products
  set
    nome = coalesce(nullif(p_produto->>'nome', ''), nome),
    descricao = coalesce(nullif(p_produto->>'descricao', ''), descricao)
  where id = v_produto.id
  returning * into v_produto;

  -- ---------- só as variações informadas - nunca sincroniza/desativa as ausentes ----------
  for v_item in select * from jsonb_array_elements(p_variacoes)
  loop
    v_sku := nullif(v_item->>'sku', '');
    if v_sku is null then
      raise exception 'SKU vazio — obrigatório para casar a variação na atualização.';
    end if;

    select id, product_id into v_variant_id, v_variant_product_id
    from public.product_variants
    where sku = v_sku and tenant_id = public.current_tenant_id();

    if not found then
      raise exception 'SKU "%" não encontrado.', v_sku;
    end if;

    if v_variant_product_id <> v_produto.id then
      raise exception 'SKU "%" pertence a outro produto (não a "%").', v_sku, p_codigo;
    end if;

    begin
      update public.product_variants
      set
        preco = coalesce(nullif(v_item->>'preco', ''), preco::text)::numeric,
        preco_promocional = coalesce(nullif(v_item->>'preco_promocional', ''), preco_promocional::text)::numeric
      where id = v_variant_id;
    exception
      when check_violation then
        declare
          v_constraint text;
        begin
          get stacked diagnostics v_constraint = constraint_name;
          raise exception '%', public.mensagem_erro_variacao(v_constraint);
        end;
    end;

    -- ---------- estoque: ENTRADA (positivo) ou SAÍDA (negativo) somada ao saldo, nunca sobrescreve ----------
    v_entrada := nullif(v_item->>'estoque_entrada', '')::integer;
    if v_entrada is not null and v_entrada <> 0 then
      perform public.registrar_movimentacao_estoque(
        p_variant_id => v_variant_id,
        p_tipo => case when v_entrada > 0 then 'entrada' else 'saida' end,
        p_quantidade => abs(v_entrada),
        p_motivo => 'Atualização em massa via reimportação de catálogo',
        p_referencia_tipo => 'importacao'
      );
    end if;
  end loop;

  return v_produto;
end;
$$;
