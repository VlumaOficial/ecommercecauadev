-- =====================================================
-- Lote de ajustes de UX no modulo de Produtos (feedback de uso real,
-- 07/08/2026) - itens 1 e 3, os dois que precisam de migration.
-- Combinados no mesmo arquivo porque os dois mexem nas MESMAS duas
-- RPCs (criar_produto_com_variacoes/atualizar_produto_com_variacoes) -
-- evita duas rodadas separadas de "create or replace" na mesma
-- funcao. As duas RPCs mantem a MESMA ASSINATURA (nenhum parametro
-- novo/removido) - diferente da migration 025, aqui NAO HA RISCO DE
-- OVERLOAD (so o corpo muda, nao a lista de parametros).
--
-- ---------- Item 1: dois minimos distintos na variacao ----------
-- "quantidade_minima" hoje e ambigua - serve tanto de "abaixo do
-- minimo" (alerta de reposicao no modulo de Estoque) quanto seria a
-- futura regra de "compra minima" no checkout, sem nenhuma distincao.
-- Separado em duas colunas:
--   - quantidade_minima_estoque (renomeada de quantidade_minima) -
--     nivel de alerta de reposicao, e o que o modulo de Estoque ja
--     usa hoje pra status "abaixo do minimo" (src/app/api/painel/
--     estoque/route.ts). Rename preserva o dado existente - nenhuma
--     variacao perde o valor que ja tinha.
--   - quantidade_minima_venda (nova) - minimo de compra do cliente,
--     pra regra de checkout futura (ainda nao existe checkout no
--     projeto - fica pronta, sem uso ainda). Default 1 (equivalente a
--     "sem restricao", ja que 1 e o minimo natural de qualquer compra).
--
-- Constraint renomeada junto (chk_variant_qtd_min -> chk_variant_
-- qtd_min_estoque) pra nao ficar com nome desalinhado do que valida -
-- RENAME COLUMN nao quebra o check existente (Postgres atualiza a
-- referencia interna sozinho), so o NOME ficaria confuso se nao
-- renomeasse tambem.
--
-- ---------- Item 3: SKU derivado pela mesma logica do codigo ----------
-- abreviar_rotulo() hoje corta cru os 4 primeiros caracteres
-- alfanumericos do rotulo da variacao (ex.: "Oscar Albino" ->
-- "OSCA", colidindo com uma variacao "Oscar" sozinha, que tambem
-- derivaria "OSCA" - o sufixo numerico "2" cobria essa colisao, mas
-- de um jeito que o usuario relatou como redundante/confuso).
--
-- Reimplementado com a MESMA REGRA de derivarPrefixo() (decisao #24,
-- src/lib/produto-codigo.ts): considera numero de palavras (ignorando
-- conectores de/da/do/e/em/com) - 1 palavra -> 3 letras; 2 palavras ->
-- 2+2; 3+ palavras -> 2+1+1... ate 4 chars. "Oscar Albino" (2
-- palavras) -> "OS"+"AL" = "OSAL", sem colidir com "Oscar" sozinho
-- (1 palavra -> "OSC").
--
-- IMPORTANTE - nao e' literalmente "a mesma funcao" chamada dos dois
-- lados: TypeScript e SQL sao runtimes diferentes, no dá pra
-- compartilhar codigo entre os dois de verdade. Isto e' uma segunda
-- IMPLEMENTACAO da MESMA REGRA (mesmo algoritmo, mesmo resultado pra
-- qualquer nome), nao a mesma funcao literalmente reaproveitada.
-- Alternativa que consideramos e descartamos: mover a geracao de SKU
-- inteira pro Route Handler (TypeScript), chamando derivarPrefixo() de
-- verdade - descartada porque a geracao de SKU hoje e atomica dentro
-- da transacao da RPC (evita corrida entre variacoes sendo criadas na
-- mesma chamada, e contra SKUs ja existentes do produto) - mover pro
-- TS exigiria replicar essa checagem de colisao fora da transacao,
-- risco de corrida (TOCTOU) que a versao atual nao tem. Ver mensagem
-- de entrega desta migration pra decisao a confirmar.
--
-- Depende da extensao "unaccent" (contrib do Postgres, remove acento -
-- equivalente ao normalize('NFD') + strip do slugify() em TypeScript).
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. Renomeia quantidade_minima -> quantidade_minima_estoque ----------
alter table public.product_variants
  rename column quantidade_minima to quantidade_minima_estoque;

alter table public.product_variants
  rename constraint chk_variant_qtd_min to chk_variant_qtd_min_estoque;

-- ---------- 2. Nova coluna: quantidade_minima_venda ----------
alter table public.product_variants
  add column if not exists quantidade_minima_venda integer not null default 1;

alter table public.product_variants
  add constraint chk_variant_qtd_min_venda check (quantidade_minima_venda >= 1);

-- ---------- 3. Extensao unaccent (remove acento em SQL) ----------
create extension if not exists unaccent with schema public;

-- ---------- 4. abreviar_rotulo: mesma regra de derivarPrefixo() ----------
-- STABLE (nao IMMUTABLE como antes): unaccent() e' STABLE no Postgres,
-- entao qualquer funcao que a chama tambem precisa ser no minimo
-- STABLE pra ser honesta sobre volatilidade (nao ha indice nenhum
-- dependendo disso hoje, mas e o rotulo correto).
create or replace function public.abreviar_rotulo(p_rotulo text)
returns text
language plpgsql
stable
as $$
declare
  v_conectores text[] := array['de', 'da', 'do', 'e', 'em', 'com'];
  v_slug text;
  v_todas_palavras text[];
  v_palavras text[];
  v_prefixo text;
  i integer;
begin
  v_slug := lower(public.unaccent(coalesce(p_rotulo, '')));
  v_slug := regexp_replace(v_slug, '[^a-z0-9\s-]', '', 'g');
  v_slug := regexp_replace(v_slug, '[\s_-]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  if v_slug = '' then
    return 'VAR';
  end if;

  v_todas_palavras := array_remove(string_to_array(v_slug, '-'), '');

  select coalesce(array_agg(p), '{}')
  into v_palavras
  from unnest(v_todas_palavras) as p
  where p <> all (v_conectores);

  if array_length(v_palavras, 1) is null then
    v_palavras := v_todas_palavras;
  end if;

  if array_length(v_palavras, 1) = 1 then
    return upper(left(v_palavras[1], 3));
  end if;

  if array_length(v_palavras, 1) = 2 then
    return upper(left(v_palavras[1], 2) || left(v_palavras[2], 2));
  end if;

  v_prefixo := left(v_palavras[1], 2);
  i := 2;
  while i <= array_length(v_palavras, 1) and length(v_prefixo) < 4 loop
    v_prefixo := v_prefixo || left(v_palavras[i], 1);
    i := i + 1;
  end loop;

  return upper(v_prefixo);
end;
$$;

-- gerar_sku_variacao chama abreviar_rotulo (agora STABLE) - precisa
-- deixar de ser IMMUTABLE tambem, mesma razao.
create or replace function public.gerar_sku_variacao(
  p_codigo_produto text,
  p_rotulo text,
  p_skus_em_uso text[]
)
returns text
language plpgsql
stable
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

-- ---------- 5. mensagem_erro_variacao: constraint renomeada + nova ----------
create or replace function public.mensagem_erro_variacao(p_constraint text)
returns text
language sql
immutable
as $$
  select case p_constraint
    when 'chk_variant_preco_promo' then 'O preço promocional deve ser menor que o preço normal.'
    when 'chk_variant_preco' then 'O preço não pode ser negativo.'
    when 'chk_variant_estoque' then 'O estoque não pode ser negativo.'
    when 'chk_variant_qtd_min_estoque' then 'A quantidade mínima de estoque deve ser pelo menos 1.'
    when 'chk_variant_qtd_min_venda' then 'A quantidade mínima de venda deve ser pelo menos 1.'
    else 'Confira os valores das variações e tente novamente.'
  end;
$$;

-- ---------- 6. criar_produto_com_variacoes: quantidade_minima -> os 2 campos ----------
-- Mesma assinatura e mesmas 9 camadas + caracteristicas da 025 (ver
-- cabecalho desta migration) - unica mudanca e' a coluna
-- quantidade_minima virar quantidade_minima_estoque +
-- quantidade_minima_venda no INSERT de product_variants.
create or replace function public.criar_produto_com_variacoes(
  p_produto jsonb,
  p_variacoes jsonb,
  p_caracteristicas jsonb default '[]'::jsonb
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produto public.products;
  v_categoria_ok boolean;
  v_unidade_ok boolean;
  v_item jsonb;
  v_nome_variacao text;
  v_sku text;
  v_skus_em_uso text[] := '{}';
  v_variant_id uuid;
  v_estoque_inicial integer;
  v_attr record;
  v_carac jsonb;
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

  select exists (
    select 1 from public.unidades_venda
    where id = (p_produto->>'unidade_venda_id')::uuid
      and tenant_id = public.current_tenant_id()
  ) into v_unidade_ok;

  if not v_unidade_ok then
    raise exception 'Unidade de venda não encontrada.';
  end if;

  for v_attr in
    select id, rotulo from public.category_attributes
    where category_id = (p_produto->>'category_id')::uuid
      and tenant_id = public.current_tenant_id()
      and ativo = true
      and obrigatorio = true
  loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(p_caracteristicas, '[]'::jsonb)) as item
      where (item->>'attribute_id')::uuid = v_attr.id
        and coalesce(btrim(item->>'valor'), '') <> ''
    ) then
      raise exception 'A característica "%" é obrigatória.', v_attr.rotulo;
    end if;
  end loop;

  begin
    insert into public.products (
      category_id, nome, slug, descricao, unidade_venda_id, destaque, ativo, codigo, codigo_visivel
    )
    values (
      (p_produto->>'category_id')::uuid,
      p_produto->>'nome',
      p_produto->>'slug',
      nullif(p_produto->>'descricao', ''),
      (p_produto->>'unidade_venda_id')::uuid,
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
        product_id, nome, sku, preco, preco_promocional, modo_estoque, saldo_estoque,
        quantidade_minima_estoque, quantidade_minima_venda
      )
      values (
        v_produto.id,
        v_nome_variacao,
        v_sku,
        (v_item->>'preco')::numeric,
        nullif(v_item->>'preco_promocional', '')::numeric,
        coalesce((v_item->>'modo_estoque')::stock_mode, 'quantitativo'),
        -- Sempre nasce com 0 - estoque inicial (se houver) vira
        -- movimentacao logo abaixo, nunca e gravado direto aqui.
        0,
        coalesce((v_item->>'quantidade_minima_estoque')::integer, 1),
        coalesce((v_item->>'quantidade_minima_venda')::integer, 1)
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

    v_estoque_inicial := nullif(v_item->>'estoque_inicial', '')::integer;
    perform public.registrar_estoque_inicial_variacao(v_variant_id, v_produto.id, v_estoque_inicial);
  end loop;

  for v_carac in select * from jsonb_array_elements(coalesce(p_caracteristicas, '[]'::jsonb))
  loop
    insert into public.product_attribute_values (product_id, attribute_id, valor)
    select v_produto.id, (v_carac->>'attribute_id')::uuid, nullif(v_carac->>'valor', '')
    where exists (
      select 1 from public.category_attributes
      where id = (v_carac->>'attribute_id')::uuid
        and category_id = (p_produto->>'category_id')::uuid
        and tenant_id = public.current_tenant_id()
        and ativo = true
    );
  end loop;

  return v_produto;
end;
$$;

-- ---------- 7. atualizar_produto_com_variacoes: quantidade_minima -> os 2 campos ----------
create or replace function public.atualizar_produto_com_variacoes(
  p_product_id uuid,
  p_produto jsonb,
  p_variacoes jsonb,
  p_caracteristicas jsonb default '[]'::jsonb
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produto public.products;
  v_categoria_ok boolean;
  v_unidade_ok boolean;
  v_item jsonb;
  v_variant_id uuid;
  v_nome_variacao text;
  v_sku text;
  v_skus_em_uso text[];
  v_ids_no_payload uuid[] := '{}';
  v_ativas_restantes integer;
  v_estoque_inicial integer;
  v_attr record;
  v_carac jsonb;
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

  select exists (
    select 1 from public.unidades_venda
    where id = (p_produto->>'unidade_venda_id')::uuid
      and tenant_id = public.current_tenant_id()
  ) into v_unidade_ok;

  if not v_unidade_ok then
    raise exception 'Unidade de venda não encontrada.';
  end if;

  for v_attr in
    select id, rotulo from public.category_attributes
    where category_id = (p_produto->>'category_id')::uuid
      and tenant_id = public.current_tenant_id()
      and ativo = true
      and obrigatorio = true
  loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(p_caracteristicas, '[]'::jsonb)) as item
      where (item->>'attribute_id')::uuid = v_attr.id
        and coalesce(btrim(item->>'valor'), '') <> ''
    ) then
      raise exception 'A característica "%" é obrigatória.', v_attr.rotulo;
    end if;
  end loop;

  begin
    update public.products
    set
      category_id = (p_produto->>'category_id')::uuid,
      nome = p_produto->>'nome',
      slug = p_produto->>'slug',
      descricao = nullif(p_produto->>'descricao', ''),
      unidade_venda_id = (p_produto->>'unidade_venda_id')::uuid,
      destaque = coalesce((p_produto->>'destaque')::boolean, false),
      ativo = coalesce((p_produto->>'ativo')::boolean, true),
      codigo_visivel = coalesce((p_produto->>'codigo_visivel')::boolean, false)
    where id = p_product_id
    returning * into v_produto;
  exception
    when unique_violation then
      raise exception 'Já existe um produto com esse nome. Ajuste o nome.';
  end;

  select coalesce(array_agg(sku) filter (where sku is not null), '{}')
  into v_skus_em_uso
  from public.product_variants
  where product_id = p_product_id;

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
          quantidade_minima_estoque = coalesce((v_item->>'quantidade_minima_estoque')::integer, quantidade_minima_estoque),
          quantidade_minima_venda = coalesce((v_item->>'quantidade_minima_venda')::integer, quantidade_minima_venda),
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
          product_id, nome, sku, preco, preco_promocional, modo_estoque, saldo_estoque,
          quantidade_minima_estoque, quantidade_minima_venda
        )
        values (
          p_product_id,
          v_nome_variacao,
          v_sku,
          (v_item->>'preco')::numeric,
          nullif(v_item->>'preco_promocional', '')::numeric,
          coalesce((v_item->>'modo_estoque')::stock_mode, 'quantitativo'),
          0,
          coalesce((v_item->>'quantidade_minima_estoque')::integer, 1),
          coalesce((v_item->>'quantidade_minima_venda')::integer, 1)
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

      v_estoque_inicial := nullif(v_item->>'estoque_inicial', '')::integer;
      perform public.registrar_estoque_inicial_variacao(v_variant_id, p_product_id, v_estoque_inicial);

      v_ids_no_payload := array_append(v_ids_no_payload, v_variant_id);
    end if;
  end loop;

  update public.product_variants
  set ativo = false
  where product_id = p_product_id
    and ativo = true
    and id <> all (v_ids_no_payload);

  select count(*) into v_ativas_restantes
  from public.product_variants
  where product_id = p_product_id and ativo = true;

  if v_ativas_restantes = 0 then
    raise exception 'O produto precisa ter pelo menos uma variação ativa.';
  end if;

  delete from public.product_attribute_values
  where product_id = p_product_id
    and attribute_id not in (
      select id from public.category_attributes
      where category_id = (p_produto->>'category_id')::uuid
        and tenant_id = public.current_tenant_id()
    );

  for v_carac in select * from jsonb_array_elements(coalesce(p_caracteristicas, '[]'::jsonb))
  loop
    insert into public.product_attribute_values (product_id, attribute_id, valor)
    select p_product_id, (v_carac->>'attribute_id')::uuid, nullif(v_carac->>'valor', '')
    where exists (
      select 1 from public.category_attributes
      where id = (v_carac->>'attribute_id')::uuid
        and category_id = (p_produto->>'category_id')::uuid
        and tenant_id = public.current_tenant_id()
        and ativo = true
    )
    on conflict (product_id, attribute_id) do update set valor = excluded.valor;
  end loop;

  return v_produto;
end;
$$;
