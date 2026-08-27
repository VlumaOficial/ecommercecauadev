-- =====================================================
-- Melhoria de notificação (c): avisar o LOJISTA (staff) quando entra
-- um pedido novo. REGRAS_DE_NEGOCIO.md §18.6(c).
--
-- Distinta das notificações ao CLIENTE (incremento 8, migrations
-- 042/043): destinatário é o STAFF (profiles), escolhido pelo admin;
-- canal por destinatário (email / whatsapp / ambos); gatilho é a
-- criação do pedido no checkout, não uma ação do vendedor. Reaproveita
-- o mesmo pipeline de baixo nível (canal-email, canal-whatsapp,
-- notification_templates, resolução de placeholders) — só muda o
-- resolvedor de destinatário e o template.
--
-- 4 partes:
--   1. profiles.whatsapp (opcional) — staff não tinha telefone em
--      lugar nenhum até agora.
--   2. order_notification_recipients — quais staff recebem o aviso e
--      por qual canal, por tenant.
--   3. notification_templates.evento passa a aceitar 'pedido_novo'.
--   4. Seed dos 2 textos-base (email + whatsapp) por tenant.
--
-- NÃO altera promover_para_staff (migration 041): a gravação de
-- profiles.whatsapp é por UPDATE simples (mesmo caminho da tela de
-- editar equipe), pra manter aquela RPC sensível (service_role-only,
-- já revisada pro bug 46) intocada.
-- =====================================================

-- ---------- Parte 1: telefone do staff (opcional) ----------
alter table public.profiles
  add column if not exists whatsapp text;

comment on column public.profiles.whatsapp is
  'Telefone do membro da equipe (opcional). Só dígitos, DDD+número, sem DDI — mesma convenção de customers.whatsapp (a app normaliza no formulário; canal-whatsapp.ts prefixa 55 no envio). Usado só na notificação de pedido novo ao lojista (REGRAS_DE_NEGOCIO.md §18.6c). NULL = staff não recebe por WhatsApp.';

-- ---------- Parte 2: destinatários do aviso de pedido novo ----------
-- Tabela dedicada (não colunas em profiles): separa "quem a pessoa é"
-- de "o que ela assina", isola por tenant no padrão de toda tabela de
-- domínio (DEFAULT current_tenant_id() + RLS). MVP tudo-ou-nada por
-- destinatário (REGRAS_DE_NEGOCIO.md §18.6) — sem coluna de evento.
create table if not exists public.order_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  ativo boolean not null default true,
  canal_email boolean not null default false,
  canal_whatsapp boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id),
  constraint onr_ativo_exige_canal check (not ativo or canal_email or canal_whatsapp)
);

comment on table public.order_notification_recipients is
  'Quais membros da equipe (profiles) recebem o aviso de "pedido novo" e por qual canal, por tenant (REGRAS_DE_NEGOCIO.md §18.6c). Configurado pelo admin em /painel/configuracoes > Notificações. Lido no envio via service role (src/lib/notificacoes/notificar-lojista.ts).';

-- FK composta: garante que a linha e o profile são do MESMO tenant
-- (defesa pra Fase SaaS; hoje single-tenant). Exige unique em
-- profiles(tenant_id, id) — id já é PK, então é só um índice extra.
do $$
begin
  alter table public.profiles
    add constraint profiles_tenant_id_id_key unique (tenant_id, id);
exception when duplicate_table or duplicate_object then null;
end $$;

do $$
begin
  alter table public.order_notification_recipients
    add constraint onr_profile_mesmo_tenant
    foreign key (tenant_id, profile_id)
    references public.profiles (tenant_id, id) on delete cascade;
exception when duplicate_object then null;
end $$;

alter table public.order_notification_recipients enable row level security;

drop policy if exists "onr_select_staff" on public.order_notification_recipients;
create policy "onr_select_staff" on public.order_notification_recipients
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists "onr_admin_write" on public.order_notification_recipients;
create policy "onr_admin_write" on public.order_notification_recipients
  for all to authenticated
  using (public.is_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_admin() and tenant_id = public.current_tenant_id());

drop trigger if exists trg_onr_updated on public.order_notification_recipients;
create trigger trg_onr_updated
  before update on public.order_notification_recipients
  for each row execute function public.set_updated_at();

-- ---------- Parte 3: novo evento no catálogo de templates ----------
alter table public.notification_templates
  drop constraint if exists notification_templates_evento_check;
alter table public.notification_templates
  add constraint notification_templates_evento_check
  check (evento in ('pedido_validado', 'pedido_ajustado', 'pedido_cancelado', 'pedido_novo'));

-- ---------- Parte 4: seed dos textos-base (email + whatsapp) ----------
-- Placeholders NOVOS deste evento: {valor_total} (formatado R$ no
-- envio) e {link_painel_pedido} (aponta pro PAINEL do vendedor,
-- /painel/pedidos/{id} — NÃO é o {link_pedido} da área do cliente).
-- on conflict do nothing: idempotente, não sobrescreve customização
-- futura (quando existir tela de edição de templates).
do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.notification_templates (tenant_id, evento, canal, assunto, corpo) values
      (v_tenant.id, 'pedido_novo', 'email', 'Novo pedido #{numero_pedido} na {nome_loja}',
       E'Entrou um novo pedido na {nome_loja}.\n\nPedido: #{numero_pedido}\nCliente: {nome_cliente}\nValor: {valor_total}\n\nAcesse o painel para validar: {link_painel_pedido}'),
      (v_tenant.id, 'pedido_novo', 'whatsapp', null,
       E'Novo pedido #{numero_pedido} na {nome_loja}.\nCliente: {nome_cliente}\nValor: {valor_total}\n\nValidar no painel: {link_painel_pedido}')
    on conflict (tenant_id, evento, canal) do nothing;
  end loop;
end $$;
