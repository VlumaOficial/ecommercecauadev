-- Migration 048: adiciona previsão de entrega ao texto do pedido_validado.
-- Placeholder {data_prevista} resolvido no orquestrador (data dd/mm/aaaa
-- ou "a combinar" quando vazia) — regra vive na resolução, não no texto,
-- pra sobreviver à edição de template pelo lojista (visão SaaS).
-- Grafia §18.5 (sem preposição+artigo antes de {nome_loja}).
--
-- ⚠️ JÁ APLICADA NO BANCO PELO PO EM 02/09/2026 — NÃO REAPLICAR.
-- Este arquivo só existe para o repo bater com o banco. Conteúdo
-- conferido byte a byte contra os 2 templates 'pedido_validado' do
-- tenant capua (corpo idêntico nos dois canais, ambos já com
-- {data_prevista}, ativo=true). Só `update` de texto fixo por
-- evento/canal — idempotente. Incremento (A) da feature "notificar o
-- cliente quando o vendedor modifica um pedido". Ver ESCOPO_PROJETO.md
-- §0 item 52 e REGRAS_DE_NEGOCIO.md §18.6b.

update public.notification_templates set
  corpo = E'Olá, {nome_cliente}!\n\nSeu pedido #{numero_pedido} foi confirmado e já está sendo preparado. Previsão de entrega: {data_prevista}.\n\nConfira os detalhes na sua área do cliente: {link_pedido}\n\n— Equipe {nome_loja}'
where evento = 'pedido_validado' and canal = 'email';

update public.notification_templates set
  corpo = E'Olá, {nome_cliente}! Seu pedido #{numero_pedido} foi confirmado. Previsão de entrega: {data_prevista}. Detalhes: {link_pedido}\n\n— Equipe {nome_loja}'
where evento = 'pedido_validado' and canal = 'whatsapp';
