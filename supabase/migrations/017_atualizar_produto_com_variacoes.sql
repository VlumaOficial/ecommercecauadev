-- =====================================================
-- Edicao atomica de produto+variacoes (simetrica a criar_produto_com_variacoes,
-- migration 016) + SKU automatico das variacoes.
--
-- Rastreabilidade (regra de ESCOPO_PROJETO.md §0): esta migration
-- FAZ "create or replace function criar_produto_com_variacoes" de novo,
-- mesmo ela ja estando aplicada (016). Motivo: a decisao do formato de
-- SKU automatico ("[codigo]-[abreviacao do rotulo]") foi fechada
-- DEPOIS da 016 ir pro banco. Nao e descarte nem bug fix - e uma
-- extensao de comportamento (a funcao ganha auto-geracao de SKU
-- quando o lojista nao digita um), decidida e registrada em
-- REGRAS_DE_NEGOCIO.md §4.4. Assinatura e efeitos anteriores da
-- funcao continuam identicos pra quem ja envia sku manual.
--
-- codigo do produto NUNCA entra no payload de edicao (imutavel -
-- decisao #18, ja garantido pelo trigger trg_products_codigo_imutavel
-- da 016). atualizar_produto_com_variacoes nem aceita esse campo.
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. Abreviacao do rotulo da variacao (p/ SKU automatico) ----------
-- Mesma tecnica ja usada no projeto pra normalizar texto em SQL sem
-- extensao unaccent (strip de tudo que nao for a-z/0-9 ascii, direto
-- na string original) - suficiente pra um identificador curto interno,
-- nao precisa ser "bonito" como o slug publico. Fallback 'VAR' se o
-- rotulo nao sobrar nenhum caractere alfanumerico (ex.: rotulo so com
-- simbolos/emoji).
create or replace function public.abreviar_rotulo(p_rotulo text)
returns text
language sql
immutable
as $$
  select upper(left(
    coalesce(nullif(regexp_replace(coalesce(p_rotulo, ''), '[^a-zA-Z0-9]', '', 'g'), ''), 'VAR'),
    4
  ));
$$;

-- ---------- 2. Escolhe um SKU automatico sem colidir com os ja usados ----------
-- Recebe a lista de SKUs ja em uso (do proprio produto - existentes +
-- os que ja foram atribuidos nesta mesma chamada) e devolve o proximo
-- livre, tentando "CODIGO-ABREV", depois "CODIGO-ABREV2", "CODIGO-ABREV3"...
create or replace function public.gerar_sku_variacao(
  p_codigo_produto text,
  p_rotulo text,
  p_skus_em_uso text[]
)
returns text
language plpgsql
immutable
as $$
declare
  v_base text;
  v_candidato text;
  v_sufixo integer := 1;
begin
  v_base := p_codigo_produto || '-' || public.abreviar_rotulo(p_rotulo);
  v_candidato := v_base;
  while v_candidato = any(coalesce(p_skus_em_uso, '{}'::text[])) loop
    v_sufixo := v_sufixo + 1;
    v_candidato := v_base || v_sufixo::text;
  end loop;
  return v_candidato;
end;
$$;

-- ---------- 3. Mensagem amigavel por constraint violada em variacao ----------
-- Fatorado pra nao duplicar o mesmo CASE em 3 pontos diferentes
-- (insercao na criacao, insercao/atualizacao na edicao). Segue o
-- padrao de mensagens de erro de REGRAS_DE_NEGOCIO.md §9.
create or replace function public.mensagem_erro_variacao(p_constraint text)
returns text
language sql
immutable
as $$
  select case p_constraint
    when 'chk_variant_preco_promo' then 'O preço promocional deve ser menor que o preço normal.'
    when 'chk_variant_preco' then 'O preço não pode ser negativo.'
    when 'chk_variant_estoque' then 'O estoque não pode ser negativo.'
    when 'chk_variant_qtd_min' then 'A quantidade mínima deve ser pelo menos 1.'
    else 'Confira os valores das variações e tente novamente.'
  end;
$$;

-- ---------- 4. criar_produto_com_variacoes ganha SKU automatico ----------
-- Mesma assinatura e mesmas garantias da 016 (tenant, atomicidade,
-- mensagens amigaveis) - so a insercao das variacoes vira um loop
-- (em vez de um INSERT...SELECT em lote) pra poder gerar o SKU
-- automatico de cada uma sem colidir com as irmas do mesmo produto,
-- inclusive as que estao sendo criadas na mesma chamada.
create or replace function public.criar_produto_com_variacoes(
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
  v_categoria_ok boolean;
  v_item jsonb;
  v_nome_variacao text;
  v_sku text;
  v_skus_em_uso text[] := '{}';
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  if p_variacoes is null or jsonb_array_length(p_variacoes) = 0 then
    raise exception 'Adicione pelo menos uma variação para o produto.';
  end if;

  select exists (
    select 1 from public.categories
    where id = (p_produto->>'category_id')::uuid
      and tenant_id = public.current_tenant_id()
  ) into v_categoria_ok;

  if not v_categoria_ok then
    raise exception 'Categoria não encontrada.';
  end if;

  begin
    insert into public.products (
      category_id, nome, slug, descricao, unidade_venda, destaque, ativo, codigo, codigo_visivel
    )
    values (
      (p_produto->>'category_id')::uuid,
      p_produto->>'nome',
      p_produto->>'slug',
      nullif(p_produto->>'descricao', ''),
      coalesce(nullif(p_produto->>'unidade_venda', ''), 'unidade'),
      coalesce((p_produto->>'destaque')::boolean, false),
      coalesce((p_produto->>'ativo')::boolean, true),
      p_produto->>'codigo',
      coalesce((p_produto->>'codigo_visivel')::boolean, false)
    )
    returning * into v_produto;
  exception
    when unique_violation then
      declare
        v_constraint text;
      begin
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'idx_products_codigo' then
          raise exception 'Já existe um produto com este código. Escolha outro.';
        else
          raise exception 'Já existe um produto com esse nome. Ajuste o nome.';
        end if;
      end;
  end;

  for v_item in select * from jsonb_array_elements(p_variacoes)
  loop
    v_nome_variacao := coalesce(nullif(v_item->>'nome', ''), 'Padrao');
    v_sku := nullif(v_item->>'sku', '');
    if v_sku is null then
      v_sku := public.gerar_sku_variacao(v_produto.codigo, v_nome_variacao, v_skus_em_uso);
    end if;
    v_skus_em_uso := array_append(v_skus_em_uso, v_sku);

    begin
      insert into public.product_variants (
        product_id, nome, sku, preco, preco_promocional, modo_estoque, saldo_estoque, quantidade_minima
      )
      values (
        v_produto.id,
        v_nome_variacao,
        v_sku,
        (v_item->>'preco')::numeric,
        nullif(v_item->>'preco_promocional', '')::numeric,
        coalesce((v_item->>'modo_estoque')::stock_mode, 'quantitativo'),
        coalesce((v_item->>'saldo_estoque')::integer, 0),
        coalesce((v_item->>'quantidade_minima')::integer, 1)
      );
    exception
      when unique_violation then
        raise exception 'Já existe uma variação com este SKU. Ajuste o SKU.';
      when check_violation then
        declare
          v_constraint text;
        begin
          get stacked diagnostics v_constraint = constraint_name;
          raise exception '%', public.mensagem_erro_variacao(v_constraint);
        end;
    end;
  end loop;

  return v_produto;
end;
$$;

-- ---------- 5. atualizar_produto_com_variacoes (NOVA) ----------
-- Edicao atomica, simetrica a criar_produto_com_variacoes: atualiza os
-- dados do produto (nunca "codigo") e sincroniza as variacoes a partir
-- da lista completa enviada pelo formulario:
--   - item com "id"    -> atualiza a variacao existente (mantem o SKU
--                         atual se o campo vier vazio - nao regenera
--                         SKU de variacao ja existente por conta propria)
--   - item sem "id"     -> cria variacao nova (gera SKU automatico se
--                         vazio, igual criar_produto_com_variacoes)
--   - variacao ativa que NAO aparece na lista -> soft delete
--     (ativo=false, nunca DELETE - soft delete universal do painel)
-- Garante pelo menos 1 variacao ativa ao final, senao a transacao
-- inteira e desfeita (exception aborta tudo, inclusive o update do
-- produto ja feito nesta mesma chamada).
create or replace function public.atualizar_produto_com_variacoes(
  p_product_id uuid,
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
  v_categoria_ok boolean;
  v_item jsonb;
  v_variant_id uuid;
  v_nome_variacao text;
  v_sku text;
  v_skus_em_uso text[];
  v_ids_no_payload uuid[] := '{}';
  v_ativas_restantes integer;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  select * into v_produto
  from public.products
  where id = p_product_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'Produto não encontrado.';
  end if;

  if p_variacoes is null or jsonb_array_length(p_variacoes) = 0 then
    raise exception 'Adicione pelo menos uma variação para o produto.';
  end if;

  select exists (
    select 1 from public.categories
    where id = (p_produto->>'category_id')::uuid
      and tenant_id = public.current_tenant_id()
  ) into v_categoria_ok;

  if not v_categoria_ok then
    raise exception 'Categoria não encontrada.';
  end if;

  -- ---------- dados do produto (codigo NUNCA entra aqui - imutavel) ----------
  begin
    update public.products
    set
      category_id = (p_produto->>'category_id')::uuid,
      nome = p_produto->>'nome',
      slug = p_produto->>'slug',
      descricao = nullif(p_produto->>'descricao', ''),
      unidade_venda = coalesce(nullif(p_produto->>'unidade_venda', ''), 'unidade'),
      destaque = coalesce((p_produto->>'destaque')::boolean, false),
      ativo = coalesce((p_produto->>'ativo')::boolean, true),
      codigo_visivel = coalesce((p_produto->>'codigo_visivel')::boolean, false)
    where id = p_product_id
    returning * into v_produto;
  exception
    when unique_violation then
      raise exception 'Já existe um produto com esse nome. Ajuste o nome.';
  end;

  -- ---------- SKUs ja em uso por este produto (ponto de partida) ----------
  select coalesce(array_agg(sku) filter (where sku is not null), '{}')
  into v_skus_em_uso
  from public.product_variants
  where product_id = p_product_id;

  -- ---------- cria ou atualiza cada variacao do payload ----------
  for v_item in select * from jsonb_array_elements(p_variacoes)
  loop
    v_variant_id := nullif(v_item->>'id', '')::uuid;
    v_nome_variacao := coalesce(nullif(v_item->>'nome', ''), 'Padrao');

    if v_variant_id is not null then
      begin
        update public.product_variants
        set
          nome = v_nome_variacao,
          sku = coalesce(nullif(v_item->>'sku', ''), product_variants.sku),
          preco = (v_item->>'preco')::numeric,
          preco_promocional = nullif(v_item->>'preco_promocional', '')::numeric,
          modo_estoque = coalesce((v_item->>'modo_estoque')::stock_mode, modo_estoque),
          saldo_estoque = coalesce((v_item->>'saldo_estoque')::integer, saldo_estoque),
          quantidade_minima = coalesce((v_item->>'quantidade_minima')::integer, quantidade_minima),
          ativo = true
        where id = v_variant_id and product_id = p_product_id;
      exception
        when unique_violation then
          raise exception 'Já existe uma variação com este SKU. Ajuste o SKU.';
        when check_violation then
          declare
            v_constraint text;
          begin
            get stacked diagnostics v_constraint = constraint_name;
            raise exception '%', public.mensagem_erro_variacao(v_constraint);
          end;
      end;

      if not found then
        raise exception 'Variação não encontrada.';
      end if;

      v_ids_no_payload := array_append(v_ids_no_payload, v_variant_id);
    else
      v_sku := nullif(v_item->>'sku', '');
      if v_sku is null then
        v_sku := public.gerar_sku_variacao(v_produto.codigo, v_nome_variacao, v_skus_em_uso);
      end if;
      v_skus_em_uso := array_append(v_skus_em_uso, v_sku);

      begin
        insert into public.product_variants (
          product_id, nome, sku, preco, preco_promocional, modo_estoque, saldo_estoque, quantidade_minima
        )
        values (
          p_product_id,
          v_nome_variacao,
          v_sku,
          (v_item->>'preco')::numeric,
          nullif(v_item->>'preco_promocional', '')::numeric,
          coalesce((v_item->>'modo_estoque')::stock_mode, 'quantitativo'),
          coalesce((v_item->>'saldo_estoque')::integer, 0),
          coalesce((v_item->>'quantidade_minima')::integer, 1)
        )
        returning id into v_variant_id;
      exception
        when unique_violation then
          raise exception 'Já existe uma variação com este SKU. Ajuste o SKU.';
        when check_violation then
          declare
            v_constraint text;
          begin
            get stacked diagnostics v_constraint = constraint_name;
            raise exception '%', public.mensagem_erro_variacao(v_constraint);
          end;
      end;

      v_ids_no_payload := array_append(v_ids_no_payload, v_variant_id);
    end if;
  end loop;

  -- ---------- soft delete das variacoes que sairam do payload ----------
  update public.product_variants
  set ativo = false
  where product_id = p_product_id
    and ativo = true
    and id <> all (v_ids_no_payload);

  -- ---------- garante pelo menos 1 variacao ativa ----------
  select count(*) into v_ativas_restantes
  from public.product_variants
  where product_id = p_product_id and ativo = true;

  if v_ativas_restantes = 0 then
    raise exception 'O produto precisa ter pelo menos uma variação ativa.';
  end if;

  return v_produto;
end;
$$;
