-- =====================================================
-- Produtos Etapa 2: Caracteristicas por produto (ficha tecnica).
-- Lojista preenche, no cadastro/edicao do produto, os valores das
-- caracteristicas configuraveis da categoria escolhida
-- (category_attributes, ja existe desde a 009). Ver ESCOPO_PROJETO.md
-- e REGRAS_DE_NEGOCIO.md §4 para o plano completo aprovado em
-- 05/08/2026.
--
-- Decisoes de produto fechadas antes desta migration:
--   1. Troca de categoria na edicao APAGA os valores da categoria
--      antiga (nao ficam orfaos invisiveis no banco) - implementado no
--      DELETE explicito dentro de atualizar_produto_com_variacoes.
--   2. Caracteristica INATIVADA na categoria (ativo=false) preserva o
--      valor ja preenchido em produtos - so some do formulario de
--      edicao (nao e mais renderizada nem enviada no payload), a linha
--      em product_attribute_values fica intocada. Reativando a
--      caracteristica, o valor volta a aparecer.
--   3. Obrigatoriedade validada nos dois lados (client E aqui, server,
--      fonte da verdade) contra as caracteristicas ATIVAS da categoria
--      sendo salva - nunca confia que o client mandou tudo.
--
-- ---------- Gap de isolamento fechado (passo 1 abaixo) ----------
-- product_attribute_values.tenant_id nunca ganhou DEFAULT
-- current_tenant_id() (mesmo gap que categories/products/
-- product_variants/product_images tinham antes das migrations
-- 010/012/015/023) - nunca se manifestou porque nenhum codigo grava
-- nessa tabela ate agora (Etapa 2 nunca foi implementada). Fechado
-- aqui, mesmo padrao das 4 migrations anteriores.
--
-- ---------- Por que "create or replace" nas RPCs, nao RPC nova ----------
-- Caracteristicas sao so texto digitado no MESMO formulario do
-- produto, no MESMO submit - ao contrario de Imagens (fluxo separado
-- por necessidade tecnica, precisa do product_id existir pra upload no
-- Storage), nao ha motivo pra desacoplar. A validacao de "obrigatoria"
-- (decisao 3 acima) so faz sentido atomica com o resto da
-- criacao/edicao, mesma transacao - mesmo espirito da garantia
-- "produto sempre nasce com >=1 variacao".
--
-- ---------- Camadas preservadas nas duas RPCs (conferir contra a versao
-- anterior, migration 022, antes de aplicar - nenhuma foi removida) ----------
-- Ambas as funcoes (criar_produto_com_variacoes / atualizar_produto_
-- com_variacoes) mantem INTACTO tudo que a 022 ja fazia:
--   1. is_staff() - acesso restrito a equipe
--   2. Validacao de categoria por tenant (v_categoria_ok)
--   3. Validacao de unidade de venda por tenant (v_unidade_ok)
--   4. Estoque inicial -> movimentacao de inventario
--      (registrar_estoque_inicial_variacao), nunca grava saldo direto
--   5. SKU automatico com colisao evitada (gerar_sku_variacao +
--      v_skus_em_uso)
--   6. Codigo IMUTAVEL na edicao (nunca entra no UPDATE de products)
--   7. Soft delete das variacoes removidas do payload (edicao)
--   8. Garantia de >=1 variacao ativa (criacao E edicao)
--   9. Mensagens de erro amigaveis (unique_violation/check_violation
--      traduzidas via mensagem_erro_variacao, nomes de constraint
--      nunca vazam pro usuario)
-- Unica adicao: paragrafo novo de caracteristicas (passo 3 e 4 abaixo),
-- em bloco proprio, sem tocar em nenhuma linha das camadas acima.
--
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. Gap de isolamento: tenant_id ganha DEFAULT ----------
alter table public.product_attribute_values
  alter column tenant_id set default public.current_tenant_id();

-- ---------- 2. criar_produto_com_variacoes: + caracteristicas ----------
-- Mesma assinatura e mesmas 9 camadas da 022 (ver cabecalho) + novo
-- parametro p_caracteristicas (default '[]'::jsonb - chamadas antigas
-- sem esse argumento continuam funcionando). Validacao de obrigatorias
-- roda ANTES de qualquer insert (falha rapido, produto nao chega a
-- nascer se faltar caracteristica obrigatoria). Insercao dos valores
-- roda DEPOIS do loop de variacoes (produto e variacoes ja existem,
-- v_produto.id disponivel) - qualquer excecao ainda desfaz tudo junto,
-- mesma transacao.
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

  -- ---------- caracteristicas obrigatorias da categoria (fonte da
  -- verdade e o servidor, nunca confia so no client) ----------
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
        product_id, nome, sku, preco, preco_promocional, modo_estoque, saldo_estoque, quantidade_minima
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

    v_estoque_inicial := nullif(v_item->>'estoque_inicial', '')::integer;
    perform public.registrar_estoque_inicial_variacao(v_variant_id, v_produto.id, v_estoque_inicial);
  end loop;

  -- ---------- valores das caracteristicas (so as que pertencem a uma
  -- caracteristica ATIVA desta categoria/tenant - qualquer attribute_id
  -- estranho no payload e silenciosamente ignorado, mesmo espirito de
  -- nao confiar no client) ----------
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

-- ---------- 3. atualizar_produto_com_variacoes: + caracteristicas ----------
-- Mesma assinatura e mesmas 9 camadas da 022 (ver cabecalho) + novo
-- parametro p_caracteristicas (default '[]'::jsonb). Alem da validacao
-- de obrigatorias (mesmo bloco da criacao, contra a categoria NOVA do
-- payload), sincroniza product_attribute_values em dois passos:
--   (a) DELETE de qualquer linha cujo attribute_id NAO pertence a
--       categoria atual (nova) - implementa a decisao de apagar
--       valores da categoria antiga ao trocar de categoria. Como
--       filtra por category_id (nao por ativo), caracteristica
--       INATIVA da MESMA categoria continua de fora do delete - o
--       valor sobrevive, so nao aparece mais no formulario.
--   (b) UPSERT dos itens do payload que pertencem a uma caracteristica
--       ATIVA da categoria atual (mesmo filtro de seguranca da
--       criacao) - on conflict(product_id, attribute_id) atualiza o
--       valor existente em vez de duplicar linha.
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

  -- ---------- caracteristicas obrigatorias da categoria NOVA (mesmo
  -- bloco da criacao - se o produto mudou de categoria, valida contra
  -- a categoria que ele esta indo, nao a que estava) ----------
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

  -- ---------- dados do produto (codigo NUNCA entra aqui - imutavel) ----------
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
      -- Variacao EXISTENTE: saldo_estoque sai do SET por completo -
      -- so muda pelo modulo de Estoque (registrar_movimentacao_estoque,
      -- 021) dali pra frente, nunca mais por aqui.
      begin
        update public.product_variants
        set
          nome = v_nome_variacao,
          sku = coalesce(nullif(v_item->>'sku', ''), product_variants.sku),
          preco = (v_item->>'preco')::numeric,
          preco_promocional = nullif(v_item->>'preco_promocional', '')::numeric,
          modo_estoque = coalesce((v_item->>'modo_estoque')::stock_mode, modo_estoque),
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
      -- Variacao NOVA (nasce durante a edicao): mesmo tratamento da
      -- criacao - sempre 0 no INSERT, estoque inicial (se houver) vira
      -- movimentacao de inventario logo em seguida.
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
          0,
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

      v_estoque_inicial := nullif(v_item->>'estoque_inicial', '')::integer;
      perform public.registrar_estoque_inicial_variacao(v_variant_id, p_product_id, v_estoque_inicial);

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

  -- ---------- caracteristicas: apaga o que nao pertence a categoria
  -- ATUAL (categoria antiga, se trocou - decisao de produto, sem
  -- orfao invisivel) ----------
  delete from public.product_attribute_values
  where product_id = p_product_id
    and attribute_id not in (
      select id from public.category_attributes
      where category_id = (p_produto->>'category_id')::uuid
        and tenant_id = public.current_tenant_id()
    );

  -- ---------- caracteristicas: upsert dos valores atuais (so as que
  -- pertencem a uma caracteristica ATIVA da categoria atual/tenant -
  -- attribute_id estranho no payload e ignorado, mesmo espirito de nao
  -- confiar no client). Caracteristica INATIVA da mesma categoria nao
  -- entra aqui (nao chega no payload, o form nao renderiza) e tambem
  -- nao foi apagada no DELETE acima (pertence a categoria atual) - o
  -- valor antigo sobrevive intocado. ----------
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
