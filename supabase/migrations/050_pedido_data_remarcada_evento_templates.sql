-- =====================================================
-- Feature "modificação de pedido pelo vendedor" — Incremento (B):
-- evento de notificação `pedido_data_remarcada` + seed dos 2 templates
-- (email + whatsapp), por tenant.
--
-- Par da migration 049 (tabela de histórico) e da 051 (RPC, a criar).
-- Disparo: `after()` no handler POST /api/painel/pedidos/[id]/
-- remarcar-entrega, depois da RPC ter sucesso — nunca dentro da RPC
-- (Postgres não chama HTTP neste projeto). Reaproveita o orquestrador
-- genérico `notificar-pedido.ts`.
--
-- Placeholder {data_prevista}: JÁ resolvido no orquestrador desde a
-- migration 048 (incremento A) — data preenchida -> dd/mm/aaaa,
-- vazia/null -> "a combinar". A remarcação atualiza orders.data_prevista
-- ANTES do disparo, então o texto mostra naturalmente a NOVA data.
--
-- O `{motivo}` NÃO entra nestes templates — a remarcação tem motivo
-- obrigatório, mas ele é interno (rastreabilidade), o cliente não vê.
--
-- Grafia §18.5 (sem preposição+artigo antes de {nome_loja}; assinatura
-- "— Equipe {nome_loja}"). Textos aprovados pelo PO.
--
-- ⚠️ NÃO APLICADA — arquivo criado para revisão do PO. O PO aplica no
-- SQL Editor após aprovar o desenho.
-- =====================================================

-- ---------- Parte 1: aceitar 'pedido_data_remarcada' no catálogo ----------
alter table public.notification_templates
  drop constraint if exists notification_templates_evento_check;
alter table public.notification_templates
  add constraint notification_templates_evento_check
  check (evento in (
    'pedido_validado', 'pedido_ajustado', 'pedido_cancelado', 'pedido_novo',
    'pedido_recebido', 'pedido_entregue', 'pedido_data_remarcada'
  ));

-- ---------- Parte 2: seed dos textos-base (email + whatsapp) ----------
-- assunto do email: NÃO foi dado pelo PO (só o corpo foi aprovado) —
-- proposta do assistente, a confirmar na revisão.
do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.notification_templates (tenant_id, evento, canal, assunto, corpo) values
      (v_tenant.id, 'pedido_data_remarcada', 'email', 'Previsão de entrega do pedido #{numero_pedido} atualizada',
       E'Olá, {nome_cliente}!\n\nA previsão de entrega do seu pedido #{numero_pedido} foi atualizada para {data_prevista}.\n\nConfira os detalhes na sua área do cliente: {link_pedido}\n\n— Equipe {nome_loja}'),
      (v_tenant.id, 'pedido_data_remarcada', 'whatsapp', null,
       E'Olá, {nome_cliente}! A previsão de entrega do seu pedido #{numero_pedido} foi atualizada para {data_prevista}. Detalhes: {link_pedido}\n\n— Equipe {nome_loja}')
    on conflict (tenant_id, evento, canal) do nothing;
  end loop;
end $$;
