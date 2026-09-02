-- =====================================================
-- Migration 047: notificação ao cliente 'pedido_entregue'
-- (incremento 3 de 4 da frente "notificações ao cliente").
-- Gatilho: RPC concluir_pedido (confirmado → concluido).
-- Reaproveita o pipeline já validado (notificar-pedido.ts,
-- NotificationChannel, templates em dados).
-- 2 partes: (1) estende o CHECK; (2) seed dos 2 textos por tenant.
-- Grafia sem preposição+artigo antes de {nome_loja} (regra §18.5);
-- branding via assinatura "— Equipe {nome_loja}".
--
-- ⚠️ JÁ APLICADA NO BANCO PELO PO EM 02/09/2026 — NÃO REAPLICAR.
-- Este arquivo só existe para o repo bater com o banco. Conteúdo
-- conferido byte a byte contra os 2 templates 'pedido_entregue' do
-- tenant capua (assunto + corpo idênticos, ativo=true; seed criou
-- 6 linhas = 3 tenants × 2 canais). Ver ESCOPO_PROJETO.md §0 item 52
-- e REGRAS_DE_NEGOCIO.md §18.6b. Parte 1 é idempotente (drop/add
-- constraint); Parte 2 usa `on conflict do nothing`.
-- =====================================================

-- Parte 1: aceitar 'pedido_entregue' no catálogo de eventos
alter table public.notification_templates
  drop constraint if exists notification_templates_evento_check;
alter table public.notification_templates
  add constraint notification_templates_evento_check
  check (evento in ('pedido_validado', 'pedido_ajustado', 'pedido_cancelado', 'pedido_novo', 'pedido_recebido', 'pedido_entregue'));

-- Parte 2: seed dos textos-base (email + whatsapp) por tenant
do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.notification_templates (tenant_id, evento, canal, assunto, corpo) values
      (v_tenant.id, 'pedido_entregue', 'email', 'Seu pedido #{numero_pedido} foi entregue',
       E'Olá, {nome_cliente}!\n\nSeu pedido #{numero_pedido} foi entregue. Obrigado pela preferência e pela confiança!\n\nConfira os detalhes na sua área do cliente: {link_pedido}\n\n— Equipe {nome_loja}'),
      (v_tenant.id, 'pedido_entregue', 'whatsapp', null,
       E'Olá, {nome_cliente}! Seu pedido #{numero_pedido} foi entregue. Obrigado pela preferência e pela confiança! Detalhes: {link_pedido}\n\n— Equipe {nome_loja}')
    on conflict (tenant_id, evento, canal) do nothing;
  end loop;
end $$;
