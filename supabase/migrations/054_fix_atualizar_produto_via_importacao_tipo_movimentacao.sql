-- =====================================================
-- Corrige um bug real na RPC atualizar_produto_via_importacao
-- (migration 053, JÁ APLICADA), achado durante o teste do Inc 4 em
-- 08/09/2026: a chamada a registrar_movimentacao_estoque() passava
-- `p_tipo` como resultado de um CASE sobre literais de texto
-- ('entrada'/'saida') SEM cast pro enum `public.stock_movement_type`
-- que o parâmetro realmente espera (migration 021). O Postgres
-- resolveu o literal dinâmico como `text` genérico em vez de inferir
-- o enum pelo contexto, e a chamada falhava sempre com "function ...
-- does not exist" - TODA atualização com estoque preenchido (entrada
-- OU saída) quebrava, mesmo as sem nenhum problema de negócio.
--
-- Único ponto corrigido: `::public.stock_movement_type` explícito no
-- resultado do CASE. Todo o resto da função é idêntico à 053 (esta é
-- uma correção pontual, não um redesenho - reproduzida por inteiro
-- aqui só porque `create or replace function` exige o corpo completo).
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

    -- ---------- ÚNICO PONTO CORRIGIDO: cast explícito pro enum ----------
    v_entrada := nullif(v_item->>'estoque_entrada', '')::integer;
    if v_entrada is not null and v_entrada <> 0 then
      perform public.registrar_movimentacao_estoque(
        p_variant_id => v_variant_id,
        p_tipo => (case when v_entrada > 0 then 'entrada' else 'saida' end)::public.stock_movement_type,
        p_quantidade => abs(v_entrada),
        p_motivo => 'Atualização em massa via reimportação de catálogo',
        p_referencia_tipo => 'importacao'
      );
    end if;
  end loop;

  return v_produto;
end;
$$;
