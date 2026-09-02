-- =====================================================
-- Feature "modificação de pedido pelo vendedor" — Incremento (B):
-- remarcação da data de entrega depois da validação.
--
-- Esta migration cria SÓ a tabela de histórico de remarcações
-- (rastreabilidade / relatórios futuros — visão SaaS). O evento de
-- notificação + templates vêm na migration 050; a RPC
-- `remarcar_entrega_pedido` vem na migration 051 (a criar). Handler
-- (`POST /api/painel/pedidos/[id]/remarcar-entrega`) e tela (diálogo
-- "Remarcar entrega") são código, fora de migration.
--
-- ⚠️ NÃO APLICADA — arquivo criado para revisão do PO. O PO aplica no
-- SQL Editor após aprovar o desenho.
--
-- Modelo: ledger append-only (mesmo princípio de `stock_movements`,
-- migration 021) — cada remarcação é UMA linha imutável; corrigir uma
-- remarcação errada é uma nova remarcação, nunca um UPDATE. Sem
-- `updated_at`, sem policy de UPDATE/DELETE.
--
-- Isolamento multi-tenant: `tenant_id` com DEFAULT current_tenant_id()
-- + RLS por tenant, padrão universal do projeto. `tenant_id`
-- denormalizado (também derivável via order_id -> orders.tenant_id) de
-- propósito, pra RLS e relatórios não precisarem de join — mesmo
-- padrão de `stock_movements` denormalizando `product_id`.
-- =====================================================

create table if not exists public.order_delivery_reschedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,

  -- data_prevista ANTES desta remarcação. NULLABLE de propósito: o
  -- pedido pode ter sido validado SEM previsão (data_prevista é
  -- opcional em validar_pedido). NULL aqui = "não havia previsão
  -- anterior" — mais honesto que uma data-sentinela. Ver decisão (a)
  -- no relato ao PO.
  data_anterior date,

  -- Nova data. NOT NULL: a ação "remarcar" sempre define uma data
  -- concreta (o input de data do diálogo é obrigatório). "Limpar a
  -- previsão" não faz parte do escopo desta feature.
  data_nova date not null,

  -- Motivo da remarcação. NOT NULL — obrigatório (decisão do PO).
  -- USO INTERNO / rastreabilidade: o cliente NUNCA vê este campo (mesma
  -- classe de `orders.observacao_interna`). Não entra em nenhuma query
  -- da vitrine/área do cliente nem no texto da notificação.
  motivo text not null,

  -- Staff que fez a remarcação. NOT NULL — toda remarcação em escopo é
  -- ação de um staff pelo diálogo; a RPC (SECURITY DEFINER) grava
  -- auth.uid() aqui. Diferente de `stock_movements.usuario_id`
  -- (nullable, por causa do backfill/"Sistema") — aqui não há caminho
  -- de sistema, então todo registro tem um responsável. Relaxar no
  -- futuro (ex.: remarcação automática) é um `alter column drop not
  -- null` de uma linha.
  alterado_por uuid not null references public.profiles(id),

  criado_em timestamptz not null default now(),

  -- motivo não pode ser só espaço em branco (espelha o guard da RPC).
  constraint chk_odr_motivo_nao_vazio check (btrim(motivo) <> ''),
  -- uma "remarcação" tem que MUDAR a data. Se data_anterior é NULL,
  -- qualquer data_nova é uma mudança real (de "sem previsão" pra uma
  -- data). Se não é NULL, tem que ser diferente.
  constraint chk_odr_data_mudou check (data_anterior is null or data_anterior <> data_nova)
);

comment on table public.order_delivery_reschedules is
  'Histórico de remarcações da data de entrega de um pedido (feature "modificação de pedido pelo vendedor", incremento B). Append-only (ledger), imutável — sem UPDATE/DELETE. Uma linha por remarcação bem-sucedida, gravada pela RPC remarcar_entrega_pedido. `motivo` é interno (rastreabilidade/relatórios) — o cliente nunca vê. RLS: só staff do próprio tenant lê; escrita só pela RPC SECURITY DEFINER.';

comment on column public.order_delivery_reschedules.data_anterior is
  'orders.data_prevista imediatamente antes desta remarcação. NULL = o pedido não tinha previsão anterior (validado sem data).';

create index if not exists idx_odr_order on public.order_delivery_reschedules (tenant_id, order_id, criado_em desc);
create index if not exists idx_odr_tenant on public.order_delivery_reschedules (tenant_id, criado_em desc);

-- ---------- RLS ----------
alter table public.order_delivery_reschedules enable row level security;

-- SELECT: só staff, só do próprio tenant (relatórios internos). NENHUMA
-- policy pra anon/cliente — `motivo` é interno, mesma regra de
-- observacao_interna.
drop policy if exists "odr_select_staff" on public.order_delivery_reschedules;
create policy "odr_select_staff" on public.order_delivery_reschedules
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

-- SEM policy de INSERT/UPDATE/DELETE de propósito. RLS nega por padrão
-- quando não há policy pro comando — nem admin escreve/edita/apaga uma
-- linha via PostgREST. A ÚNICA forma de inserir é a RPC
-- remarcar_entrega_pedido (SECURITY DEFINER, migration 051), que roda
-- com o privilégio do dono da função e garante que data_anterior é um
-- snapshot real de orders.data_prevista, não um valor vindo do client.
-- (Mais estrito que stock_movements, que permite insert direto de
-- staff — aqui a integridade do registro de auditoria vale mais que a
-- conveniência de insert manual, pra qual não há caso de uso. Ver
-- relato ao PO.)
