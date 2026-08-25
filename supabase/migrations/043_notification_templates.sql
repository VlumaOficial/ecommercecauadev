-- =====================================================
-- Fase 2, incremento 8 (Notificações) — tabela de templates de
-- notificação, por tenant. Decisão de produto do PO (25/08/2026):
-- os textos NÃO ficam hardcoded em código — ficam em DADOS, com
-- placeholders resolvidos no envio. Motivo: abre caminho pra uma
-- tela de edição por tenant no futuro (NÃO construída agora, só a
-- tabela + os defaults + o código lendo daqui) sem precisar migrar
-- texto de constante pra banco depois.
--
-- 3 eventos (REGRAS_DE_NEGOCIO.md §18.1) x 2 canais = 6 linhas por
-- tenant. Placeholders resolvidos em src/lib/notificacoes/templates.ts:
-- {nome_cliente}, {numero_pedido}, {nome_loja}, {link_pedido},
-- {motivo} (só cancelamento - sempre preenchido, manual exige motivo
-- e o cancelamento automático já grava um fixo, ver migration 039).
-- =====================================================

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  evento text not null check (evento in ('pedido_validado', 'pedido_ajustado', 'pedido_cancelado')),
  canal text not null check (canal in ('email', 'whatsapp')),
  -- so' usado no canal email (WhatsApp nao tem campo de assunto).
  assunto text,
  corpo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, evento, canal)
);

comment on table public.notification_templates is
  'Textos das notificacoes de pedido (validado/ajustado/cancelado, email/whatsapp), por tenant. Editavel via SQL direto por ora - tela de edicao no painel e fase futura, arquitetura (RLS staff-select/admin-write) ja pronta pra receber. Lido por src/lib/notificacoes/templates.ts via service role (leitura interna do sistema, nao exposta a anon/cliente).';

alter table public.notification_templates enable row level security;

drop policy if exists "notification_templates_select_staff" on public.notification_templates;
create policy "notification_templates_select_staff" on public.notification_templates
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists "notification_templates_admin_write" on public.notification_templates;
create policy "notification_templates_admin_write" on public.notification_templates
  for all to authenticated
  using (public.is_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_admin() and tenant_id = public.current_tenant_id());

drop trigger if exists trg_notification_templates_updated on public.notification_templates;
create trigger trg_notification_templates_updated
  before update on public.notification_templates
  for each row execute function public.set_updated_at();

-- ---------- Seed: defaults pra cada tenant ja existente ----------
-- on conflict do nothing - idempotente, nao sobrescreve customizacao
-- futura (quando a tela de edicao existir) se esta migration rodar
-- de novo num ambiente que ja tem as linhas.
do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.notification_templates (tenant_id, evento, canal, assunto, corpo) values
      (v_tenant.id, 'pedido_validado', 'email', 'Pedido #{numero_pedido} confirmado',
       E'Olá, {nome_cliente}!\n\nSeu pedido #{numero_pedido} na {nome_loja} foi confirmado e já está sendo preparado.\n\nConfira os detalhes na sua área do cliente: {link_pedido}\n\nQualquer dúvida, é só chamar a gente.'),
      (v_tenant.id, 'pedido_validado', 'whatsapp', null,
       'Olá, {nome_cliente}! Seu pedido #{numero_pedido} na {nome_loja} foi confirmado. Detalhes: {link_pedido}'),
      (v_tenant.id, 'pedido_ajustado', 'email', 'Seu pedido #{numero_pedido} foi ajustado',
       E'Olá, {nome_cliente}!\n\nSeu pedido #{numero_pedido} na {nome_loja} foi ajustado: um ou mais itens foram reduzidos ou removidos por falta de estoque.\n\nConfira o que mudou na sua área do cliente: {link_pedido}\n\nQualquer dúvida, é só chamar a gente.'),
      (v_tenant.id, 'pedido_ajustado', 'whatsapp', null,
       'Olá, {nome_cliente}! Seu pedido #{numero_pedido} na {nome_loja} foi ajustado: um ou mais itens foram reduzidos ou removidos por falta de estoque. Confira o que mudou: {link_pedido}'),
      (v_tenant.id, 'pedido_cancelado', 'email', 'Pedido #{numero_pedido} cancelado',
       E'Olá, {nome_cliente}!\n\nSeu pedido #{numero_pedido} na {nome_loja} foi cancelado. Motivo: {motivo}\n\nConfira os detalhes na sua área do cliente: {link_pedido}\n\nQualquer dúvida, é só chamar a gente.'),
      (v_tenant.id, 'pedido_cancelado', 'whatsapp', null,
       'Olá, {nome_cliente}! Seu pedido #{numero_pedido} na {nome_loja} foi cancelado. Motivo: {motivo}')
    on conflict (tenant_id, evento, canal) do nothing;
  end loop;
end $$;
