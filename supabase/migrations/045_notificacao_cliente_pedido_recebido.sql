-- =====================================================
-- Melhoria de notificação (b), incremento 1 de 4: avisar o CLIENTE
-- que o pedido foi RECEBIDO, no momento em que ele finaliza o
-- checkout (antes de qualquer validação do vendedor).
-- REGRAS_DE_NEGOCIO.md §18.6(b).
--
-- Frente "notificações ao cliente" — 4 eventos, incrementais, um por
-- vez. Esta migration cobre SÓ 'pedido_recebido'. Os outros 3
-- ('pedido_aprovado' via validar_pedido, 'pedido_entregue' via
-- concluir_pedido, 'pedido_cancelado' via cancelar_pedido — os 3
-- gatilhos já existem) entram em migrations seguintes, uma por
-- incremento.
--
-- Reaproveita 100% do pipeline já validado (incremento 8 +
-- notificação ao lojista/migration 044): NotificationChannel,
-- src/lib/notificacoes/notificar-pedido.ts (orquestrador do
-- CLIENTE), notification_templates (textos em dados), disparo via
-- after() do Next.js. Destinatário aqui é o próprio cliente
-- (contato em customers), nunca staff — pipeline separado do
-- notificar-lojista.ts (evento 'pedido_novo', destinatário via
-- order_notification_recipients), sem cruzamento.
--
-- 2 partes:
--   1. notification_templates.evento passa a aceitar 'pedido_recebido'.
--   2. Seed dos 2 textos-base (email + whatsapp), tom pro cliente,
--      por tenant.
-- =====================================================

-- ---------- Parte 1: novo evento no catálogo de templates ----------
alter table public.notification_templates
  drop constraint if exists notification_templates_evento_check;
alter table public.notification_templates
  add constraint notification_templates_evento_check
  check (evento in ('pedido_validado', 'pedido_ajustado', 'pedido_cancelado', 'pedido_novo', 'pedido_recebido'));

-- ---------- Parte 2: seed dos textos-base (email + whatsapp) ----------
-- Placeholders (mesmos já resolvidos em src/lib/notificacoes/templates.ts
-- pelo orquestrador do cliente): {nome_cliente}, {numero_pedido},
-- {nome_loja}, {link_pedido} (área do cliente — /meus-pedidos/{numero}).
-- Sem placeholders novos neste evento.
-- on conflict do nothing: idempotente, não sobrescreve customização
-- futura (quando existir tela de edição de templates).
do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.notification_templates (tenant_id, evento, canal, assunto, corpo) values
      (v_tenant.id, 'pedido_recebido', 'email', 'Recebemos seu pedido #{numero_pedido}!',
       E'Olá, {nome_cliente}!\n\nRecebemos seu pedido #{numero_pedido} na {nome_loja} e em breve confirmaremos os detalhes.\n\nVocê pode acompanhar o andamento na sua área do cliente: {link_pedido}\n\nObrigado por comprar na {nome_loja}!'),
      (v_tenant.id, 'pedido_recebido', 'whatsapp', null,
       E'Olá, {nome_cliente}! Recebemos seu pedido #{numero_pedido} na {nome_loja} e em breve confirmaremos os detalhes. Acompanhe: {link_pedido}')
    on conflict (tenant_id, evento, canal) do nothing;
  end loop;
end $$;
