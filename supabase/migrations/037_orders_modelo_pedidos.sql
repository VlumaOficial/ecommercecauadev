-- =====================================================
-- Fase 2, incremento 3 do roteiro (item 34/ponto 8): modelo de
-- pedidos. SÓ dados (tabelas + RPC de criação) — carrinho,
-- checkout e painel de pedidos vêm nos incrementos seguintes,
-- nenhuma tela consome isto ainda.
--
-- Escopo decidido com o PO nesta sessão, ANTES desta migration:
--   1. orders/order_items — desenho revisado e aprovado.
--   2. Reserva/baixa de estoque NÃO acontece na criação do pedido
--      (correção de princípio registrada em REGRAS_DE_NEGOCIO.md
--      §16.4 — a decisão original de "baixa na finalização" tinha
--      sido influenciada pela operação do Cauã, não pelo princípio
--      de produto). No MVP (Fluxo A, `baixa_estoque_na_reserva=
--      false`), o pedido nasce como SOLICITAÇÃO — a baixa de
--      verdade só acontece na validação do vendedor (incremento 7,
--      ainda não desenhado). Por isso esta RPC não trava variação
--      nenhuma com FOR UPDATE, não toca `saldo_estoque`, não
--      insere em `stock_movements` — nada de estoque aqui.
--
-- Número de pedido legível (`orders.numero`): sequencial por
-- tenant, mesmo padrão de contador atômico já usado por
-- `product_code_sequences`/`category_code_sequences` (insert ...
-- on conflict ... do update ... returning, sem necessidade de
-- FOR UPDATE explícito — o upsert já é atômico por natureza).
-- `unique (tenant_id, numero)` fica como rede de segurança extra
-- contra qualquer colisão, mesmo sendo o upsert já atômico.
--
-- Isolamento multi-tenant: `tenant_id` com `DEFAULT
-- current_tenant_id()` nas 3 tabelas nesta migration, RLS restrita
-- por tenant nas leituras — mesmo padrão universal do projeto.
--
-- Segurança da RPC: `customer_id` é SEMPRE resolvido a partir de
-- `auth.uid()` dentro da função — nunca aceito como parâmetro
-- vindo do client (mesmo princípio já aplicado ao fechar o gap de
-- `role` na migration 033 — nunca confiar em identidade que o
-- client possa forjar). `delivery_city_id` é validado internamente
-- (existe, pertence ao tenant, está ativa) — nunca um id cego.
--
-- Cliente convidado (sem conta) NÃO é suportado nesta migration —
-- `customer_id` é `not null`, `customers.auth_user_id` continua
-- `not null` (não alterado aqui). Só cliente cadastrado consegue
-- ter pedido por enquanto; convidado fica pro incremento 5
-- (Checkout), onde essa decisão precisa ser tomada de verdade.
--
-- `modalidade_entrega` é texto + CHECK (não enum) de propósito —
-- decisão de produto já registrada é que esse campo é extensível
-- (frete calculado, retirada, Correios entram depois); estender um
-- CHECK é mais barato que um `ALTER TYPE` em enum.
--
-- `delivery_city_id` é NULLABLE na coluna, de propósito — modalidades
-- futuras (retirada no local, Correios) podem não usar cidade
-- nenhuma, e a coluna não deve travar a estrutura pra esse caso.
-- A obrigatoriedade de cidade é regra de NEGÓCIO da modalidade
-- "ponto de encontro" especificamente, não uma restrição estrutural
-- da tabela — por isso vive na RPC (`criar_pedido` recusa o pedido
-- se `modalidade_entrega='ponto_encontro'` e a cidade não vier
-- preenchida/válida), nunca como `NOT NULL`/CHECK na tabela.
-- =====================================================

-- ---------- 1. Enum de status do pedido ----------
do $$ begin
  create type public.order_status as enum (
    'aguardando_validacao', 'confirmado', 'concluido', 'cancelado'
  );
exception when duplicate_object then null; end $$;

-- ---------- 2. order_number_sequences ----------
-- Contador atômico por tenant (sem prefixo — diferente do código
-- de produto, o número do pedido não varia por categoria/nome).
create table if not exists public.order_number_sequences (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  ultimo_numero integer not null default 0
);

comment on table public.order_number_sequences is
  'Contador do proximo numero de pedido, por tenant. So a RPC criar_pedido escreve (upsert atomico) - nenhuma policy de insert/update/delete pra anon/authenticated.';

alter table public.order_number_sequences enable row level security;

drop policy if exists "order_number_sequences_select_staff" on public.order_number_sequences;
create policy "order_number_sequences_select_staff" on public.order_number_sequences
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- 3. orders ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete restrict,
  numero integer not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  status public.order_status not null default 'aguardando_validacao',
  modalidade_entrega text not null default 'ponto_encontro',
  delivery_city_id uuid references public.delivery_cities(id) on delete restrict,
  data_prevista date,
  data_efetiva timestamptz,
  observacao_cliente text,
  observacao_interna text,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_orders_tenant_numero unique (tenant_id, numero),
  constraint chk_orders_modalidade_entrega check (modalidade_entrega in ('ponto_encontro')),
  constraint chk_orders_total check (total >= 0)
);

comment on table public.orders is
  'Pedidos (Fase 2, Fluxo A/MVP). Nasce sempre com status=aguardando_validacao, sem reserva/baixa de estoque (ver REGRAS_DE_NEGOCIO.md §16.4) - baixa de verdade acontece na validacao do vendedor (incremento 7, ainda nao existe). Escrita so pela RPC criar_pedido (e futuras RPCs de validar/editar/cancelar) - nenhuma policy de insert/update/delete pra anon/authenticated.';

comment on column public.orders.observacao_interna is
  'Anotacao do vendedor sobre o pedido - o cliente NUNCA ve este campo (REGRAS_DE_NEGOCIO.md §19.3). So staff tem select nesta tabela alem do proprio cliente, e o cliente so ve as proprias linhas - mas o campo em si nao e filtrado por policy de coluna, so por convencao de nunca ser exposto nas RPCs/telas publicas.';

create index if not exists idx_orders_tenant on public.orders(tenant_id, created_at desc);
create index if not exists idx_orders_customer on public.orders(customer_id);

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

drop policy if exists "orders_select_staff" on public.orders;
create policy "orders_select_staff" on public.orders
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select to authenticated
  using (
    customer_id in (
      select c.id from public.customers c where c.auth_user_id = auth.uid()
    )
  );

-- Sem policy de insert/update/delete de proposito: so a RPC
-- criar_pedido (SECURITY DEFINER) cria pedido hoje; validar/editar/
-- cancelar (incremento 7) vao precisar das proprias RPCs, nunca de
-- UPDATE direto via PostgREST.

-- ---------- 4. order_items ----------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  -- denormalizado de proposito (mesmo padrao de stock_movements.product_id)
  product_id uuid not null references public.products(id) on delete restrict,
  quantidade integer not null,
  -- snapshot do preco no momento do pedido - nunca relido de
  -- product_variants depois (preco pode mudar)
  preco_unitario numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_order_items_quantidade check (quantidade > 0),
  constraint chk_order_items_preco check (preco_unitario >= 0),
  constraint chk_order_items_subtotal check (subtotal = preco_unitario * quantidade)
);

comment on table public.order_items is
  'Itens de um pedido, com snapshot de preco no momento da criacao. updated_at incluido desde ja pensando na edicao do vendedor ao validar (REGRAS_DE_NEGOCIO.md §15.4 - so reduzir/remover, incremento 7, ainda nao construido). Escrita so pela RPC criar_pedido - nenhuma policy de insert/update/delete pra anon/authenticated.';

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_variant on public.order_items(variant_id);
create index if not exists idx_order_items_tenant on public.order_items(tenant_id);

drop trigger if exists trg_order_items_updated on public.order_items;
create trigger trg_order_items_updated
  before update on public.order_items
  for each row execute function public.set_updated_at();

alter table public.order_items enable row level security;

drop policy if exists "order_items_select_staff" on public.order_items;
create policy "order_items_select_staff" on public.order_items
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select to authenticated
  using (
    order_id in (
      select o.id from public.orders o
      join public.customers c on c.id = o.customer_id
      where c.auth_user_id = auth.uid()
    )
  );

-- ---------- 5. RPC criar_pedido ----------
-- Enxuta de proposito: cria pedido + itens + total + numero. NAO
-- mexe em estoque (sem FOR UPDATE, sem saldo_estoque, sem
-- stock_movements) - ver nota no cabecalho desta migration.
create or replace function public.criar_pedido(
  p_modalidade_entrega text default 'ponto_encontro',
  p_delivery_city_id uuid default null,
  p_observacao_cliente text default null,
  p_itens jsonb default '[]'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_tenant_id uuid;
  v_loja_aberta boolean;
  v_pedidos_abertos boolean;
  v_cidade_ok boolean;
  v_numero integer;
  v_order public.orders;
  v_item jsonb;
  v_variant_id uuid;
  v_quantidade integer;
  v_variante record;
  v_preco numeric(12,2);
  v_subtotal numeric(12,2);
  v_total numeric(12,2) := 0;
begin
  -- 1. Cliente resolvido pela SESSAO - nunca por parametro do client
  -- (mesmo principio ja aplicado ao fechar o gap de role, migration 033).
  select c.id, c.tenant_id
  into v_customer_id, v_tenant_id
  from public.customers c
  where c.auth_user_id = auth.uid() and c.ativo = true;

  if not found then
    raise exception 'Não foi possível identificar sua conta. Faça login novamente.';
  end if;

  -- 2. Defesa em profundidade: a loja/os pedidos precisam estar
  -- abertos, mesmo que o carrinho (incremento 4) ja deva ter
  -- barrado isso antes de chegar aqui.
  select s.loja_aberta, s.pedidos_abertos
  into v_loja_aberta, v_pedidos_abertos
  from public.store_settings s
  where s.tenant_id = v_tenant_id;

  if not found or not v_loja_aberta then
    raise exception 'A loja está fechada no momento.';
  end if;

  if not v_pedidos_abertos then
    raise exception 'Os pedidos deste ciclo ainda não começaram.';
  end if;

  -- 3. Modalidade de entrega - MVP so aceita ponto de encontro por
  -- cidade. delivery_city_id fica NULLABLE na coluna (modalidades
  -- futuras sem cidade - retirada, Correios - vao deixar essa coluna
  -- vazia); a obrigatoriedade de cidade e' regra de NEGOCIO da
  -- modalidade "ponto de encontro" especificamente, por isso vive
  -- aqui na RPC, condicionada a modalidade_entrega, nunca como
  -- NOT NULL/CHECK na tabela. Cidade sempre validada internamente
  -- (existe, pertence ao tenant, ativa) - nunca um id cego vindo do
  -- client.
  if p_modalidade_entrega <> 'ponto_encontro' then
    raise exception 'Modalidade de entrega inválida.';
  end if;

  if p_modalidade_entrega = 'ponto_encontro' then
    if p_delivery_city_id is null then
      raise exception 'Selecione a cidade de entrega.';
    end if;

    select exists (
      select 1 from public.delivery_cities dc
      where dc.id = p_delivery_city_id
        and dc.tenant_id = v_tenant_id
        and dc.ativo = true
    ) into v_cidade_ok;

    if not v_cidade_ok then
      raise exception 'Cidade de entrega não encontrada.';
    end if;
  end if;

  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Adicione pelo menos um item ao pedido.';
  end if;

  -- 4. Numero sequencial do pedido - upsert atomico por tenant,
  -- mesmo padrao ja usado por gerar_codigo_produto_por_prefixo
  -- (migration 024). unique(tenant_id, numero) na tabela fica como
  -- rede de seguranca extra.
  insert into public.order_number_sequences (tenant_id, ultimo_numero)
  values (v_tenant_id, 1)
  on conflict (tenant_id) do update
    set ultimo_numero = order_number_sequences.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  -- 5. Cria o pedido (total fechado no passo 7, depois dos itens).
  insert into public.orders (
    tenant_id, numero, customer_id, status, modalidade_entrega,
    delivery_city_id, observacao_cliente
  ) values (
    v_tenant_id, v_numero, v_customer_id, 'aguardando_validacao', p_modalidade_entrega,
    p_delivery_city_id, nullif(btrim(coalesce(p_observacao_cliente, '')), '')
  )
  returning * into v_order;

  -- 6. Itens do pedido - snapshot de preco, SEM tocar estoque.
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    begin
      v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
      v_quantidade := nullif(v_item->>'quantidade', '')::integer;
    exception when others then
      raise exception 'Item do pedido inválido.';
    end;

    if v_variant_id is null or v_quantidade is null or v_quantidade <= 0 then
      raise exception 'Item do pedido inválido.';
    end if;

    select pv.id, pv.product_id, pv.preco, pv.preco_promocional, pv.quantidade_minima_venda
    into v_variante
    from public.product_variants pv
    where pv.id = v_variant_id
      and pv.tenant_id = v_tenant_id
      and pv.ativo = true;

    if not found then
      raise exception 'Um dos itens do pedido não foi encontrado.';
    end if;

    if v_quantidade < v_variante.quantidade_minima_venda then
      raise exception 'Quantidade abaixo do mínimo permitido para um dos itens.';
    end if;

    v_preco := coalesce(v_variante.preco_promocional, v_variante.preco);
    v_subtotal := v_preco * v_quantidade;

    insert into public.order_items (
      tenant_id, order_id, variant_id, product_id, quantidade, preco_unitario, subtotal
    ) values (
      v_tenant_id, v_order.id, v_variante.id, v_variante.product_id,
      v_quantidade, v_preco, v_subtotal
    );

    v_total := v_total + v_subtotal;
  end loop;

  -- 7. Fecha o total do pedido.
  update public.orders
  set total = v_total
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.criar_pedido(text, uuid, text, jsonb) is
  'Cria pedido + itens (Fluxo A/MVP). customer_id sempre resolvido de auth.uid() - nunca aceito como parametro. NAO mexe em estoque (sem FOR UPDATE, sem saldo_estoque, sem stock_movements) - baixa_estoque_na_reserva=false no MVP, a baixa de verdade acontece na validacao do vendedor (incremento 7, ainda nao existe). Mensagens de erro em portugues claro (REGRAS_DE_NEGOCIO.md §9) - nunca expoe detalhe tecnico ao cliente.';

grant execute on function public.criar_pedido(text, uuid, text, jsonb) to authenticated;
