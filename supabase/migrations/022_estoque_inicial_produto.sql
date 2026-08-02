-- =====================================================
-- Integra o modulo de Estoque (021) as RPCs de produto: estoque
-- inicial vira movimentacao de inventario (nunca mais grava
-- saldo_estoque direto), e edicao de produto para de mexer em saldo
-- por completo. Decisao de produto fechada em 01/08/2026.
--
-- Resposta a pergunta do usuario sobre o `revoke update (saldo_estoque)`
-- da 021: NAO ha gap de comportamento entre aplicar 021 e 022 em
-- sequencia. O revoke da 021 bloqueia UPDATE na coluna pro role
-- `authenticated` - mas as versoes atuais de criar/atualizar_produto_
-- com_variacoes (016/017/019) escrevem saldo_estoque via INSERT (na
-- criacao) ou rodam como SECURITY DEFINER (na edicao), e SECURITY
-- DEFINER executa com o privilegio de quem CRIOU a funcao, nao do
-- role authenticated - o revoke nunca as afetou, mesmo antes desta
-- migration existir. Aplicar as duas em sequencia (021 depois 022,
-- sem gap) e a ordem certa mesmo assim: e o jeito mais simples de
-- garantir que o modulo de Estoque (tabela + RPC) ja existe no
-- momento em que estas RPCs revisadas tentam usa-lo.
--
-- Payload de variacao: campo renomeado de "saldo_estoque" para
-- "estoque_inicial" (decisao do usuario) - deixa explicito que so
-- vale no nascimento da variacao (criacao do produto, ou variacao
-- nova adicionada numa edicao), nunca mais depois.
--
-- Duplicacao deliberada: em vez de reescrever registrar_movimentacao_
-- estoque (021, ja aprovada e prestes a ser aplicada - evitar reabrir
-- esse arquivo), o "gerar uma movimentacao de inventario" fica numa
-- funcao auxiliar NOVA (registrar_estoque_inicial_variacao), chamada
-- tanto por criar_produto_com_variacoes quanto pelo braco de "variacao
-- nova" de atualizar_produto_com_variacoes - mesmo padrao ja usado em
-- abreviar_rotulo/gerar_sku_variacao/mensagem_erro_variacao (017):
-- factorar o que e comum, sem duplicar a logica em dois lugares.
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. Funcao auxiliar: estoque inicial -> movimentacao de inventario ----------
-- Chamada so no momento em que uma variacao NASCE (criacao de produto,
-- ou variacao nova numa edicao) - nunca depois. Nao checa is_staff()
-- nem tenant: quem chama (criar/atualizar_produto_com_variacoes) ja
-- validou os dois antes de chegar aqui, e variant_id/product_id ja
-- sao conhecidos-de-confianca nesse ponto (acabaram de ser inseridos
-- pela propria funcao chamadora, na mesma transacao).
create or replace function public.registrar_estoque_inicial_variacao(
  p_variant_id uuid,
  p_product_id uuid,
  p_estoque_inicial integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modo public.stock_mode;
begin
  -- Sem estoque inicial informado (nulo, vazio ou zero): nada a fazer,
  -- variacao nasce com saldo 0 (default da coluna), sem movimentacao
  -- nenhuma (chk_stock_movements_quantidade_nao_zero nem deixaria).
  if p_estoque_inicial is null or p_estoque_inicial <= 0 then
    return;
  end if;

  select modo_estoque into v_modo
  from public.product_variants
  where id = p_variant_id;

  -- Variacao "disponibilidade" nao controla saldo por quantidade -
  -- estoque inicial nao faz sentido pra ela, ignora silenciosamente
  -- em vez de erro (mesmo espirito de "campo que so se aplica em
  -- certos casos", sem travar o cadastro do produto por isso).
  if v_modo <> 'quantitativo' then
    return;
  end if;

  insert into public.stock_movements (
    variant_id, product_id, tipo, quantidade, saldo_anterior, saldo_novo, motivo, usuario_id
  )
  values (
    p_variant_id, p_product_id, 'inventario', p_estoque_inicial, 0, p_estoque_inicial,
    'Estoque inicial no cadastro do produto', auth.uid()
  );

  update public.product_variants
  set saldo_estoque = p_estoque_inicial
  where id = p_variant_id;
end;
$$;

-- ---------- 2. criar_produto_com_variacoes: estoque inicial vira movimentacao ----------
-- Mesma assinatura e mesmas garantias da 019 (tenant, atomicidade, SKU
-- automatico, mensagens amigaveis) - so troca como o estoque inicial e
-- gravado: variacao sempre nasce com saldo_estoque = 0 no INSERT, e se
-- "estoque_inicial" veio preenchido no payload, o saldo real e
-- aplicado logo em seguida via registrar_estoque_inicial_variacao
-- (movimentacao de inventario + update do saldo, nunca mais o INSERT
-- gravando o valor direto).
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
  v_unidade_ok boolean;
  v_item jsonb;
  v_nome_variacao text;
  v_sku text;
  v_skus_em_uso text[] := '{}';
  v_variant_id uuid;
  v_estoque_inicial integer;
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

  return v_produto;
end;
$$;

-- ---------- 3. atualizar_produto_com_variacoes: saldo some da edicao ----------
-- Mesma logica de sincronizacao por diff da 019 (variacao existente
-- atualiza campos, variacao nova nasce, variacao que sumiu do payload
-- vira soft delete) - so muda em dois pontos: (1) variacao EXISTENTE
-- nunca mais tem saldo_estoque tocado, nem lido nem escrito, mesmo que
-- o payload mande algo nesse campo; (2) variacao NOVA (criada durante
-- a edicao) recebe o mesmo tratamento de estoque inicial da criacao -
-- nasce com 0, ganha uma movimentacao de inventario se "estoque_inicial"
-- veio preenchido.
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
  v_unidade_ok boolean;
  v_item jsonb;
  v_variant_id uuid;
  v_nome_variacao text;
  v_sku text;
  v_skus_em_uso text[];
  v_ids_no_payload uuid[] := '{}';
  v_ativas_restantes integer;
  v_estoque_inicial integer;
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

  return v_produto;
end;
$$;
