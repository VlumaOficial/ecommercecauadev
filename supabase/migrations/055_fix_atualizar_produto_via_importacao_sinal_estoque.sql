-- =====================================================
-- Corrige um SEGUNDO bug real na RPC atualizar_produto_via_importacao
-- (053, corrigida uma vez pela 054 - ainda tinha este outro), achado
-- no reteste do Inc 4 em 09/09/2026: `registrar_movimentacao_estoque`
-- NÃO inverte o sinal pelo `p_tipo` - quem chama precisa passar
-- `p_quantidade` já com o sinal certo (`v_delta := p_quantidade`
-- direto, migration 021). A constraint `chk_stock_movements_sinal`
-- exige `tipo='saida' and quantidade<0` - a 054 passava
-- `abs(v_entrada)` (sempre positivo) mesmo pra saída, violando essa
-- constraint sempre que `estoque_entrada` era negativo (toda SAÍDA
-- falhava com "Não foi possível registrar a movimentação").
--
-- Único ponto corrigido: `p_quantidade => v_entrada` (o valor já vem
-- com o sinal certo da planilha - positivo = entrada, negativo =
-- saída - não precisa mais de `abs()`). Resto da função idêntico à
-- 054 (reproduzida por inteiro só porque `create or replace function`
-- exige o corpo completo).
-- =====================================================

create or replace function public.atualizar_produto_via_importacao(
  p_codigo text,
  p_produto jsonb,
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

  update public.products
  set
    nome = coalesce(nullif(p_produto->>'nome', ''), nome),
    descricao = coalesce(nullif(p_produto->>'descricao', ''), descricao)
  where id = v_produto.id
  returning * into v_produto;

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

    v_entrada := nullif(v_item->>'estoque_entrada', '')::integer;
    if v_entrada is not null and v_entrada <> 0 then
      -- ---------- ÚNICO PONTO CORRIGIDO: quantidade já assinada, sem abs() ----------
      perform public.registrar_movimentacao_estoque(
        p_variant_id => v_variant_id,
        p_tipo => (case when v_entrada > 0 then 'entrada' else 'saida' end)::public.stock_movement_type,
        p_quantidade => v_entrada,
        p_motivo => 'Atualização em massa via reimportação de catálogo',
        p_referencia_tipo => 'importacao'
      );
    end if;
  end loop;

  return v_produto;
end;
$$;
