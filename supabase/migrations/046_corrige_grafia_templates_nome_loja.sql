-- =====================================================
-- Correção de grafia nos templates de notificação — espelha exatamente
-- os UPDATEs já aplicados no banco pelo PO em 01/09/2026. Este arquivo
-- é só para o repo bater com o banco: NÃO reaplicar (idempotente de
-- qualquer forma — é `set` de texto fixo por evento/canal).
--
-- Motivo: os textos usavam "na/no {nome_loja}" (ex.: "na {nome_loja}").
-- {nome_loja} é resolvido por tenant no envio (src/lib/notificacoes/
-- templates.ts) — a preposição+artigo fixa quebra a concordância de
-- gênero quando o nome da loja é masculino ("na Criatório..." errado).
-- Correção: remover a preposição+artigo antes de {nome_loja}; o
-- branding é preservado por uma assinatura final "— Equipe {nome_loja}"
-- (ou pelo nome isolado, sem preposição). Vale para TODOS os tenants e
-- TODOS os eventos (lojista + cliente).
--
-- Regra registrada em REGRAS_DE_NEGOCIO.md §18 — vale para os
-- incrementos 2–4 da frente de notificações ao cliente e qualquer
-- template futuro.
-- =====================================================

-- pedido_novo (lojista)
update public.notification_templates set
  assunto = 'Novo pedido #{numero_pedido} — {nome_loja}',
  corpo = E'Entrou um novo pedido.\n\nPedido: #{numero_pedido}\nCliente: {nome_cliente}\nValor: {valor_total}\n\nAcesse o painel para validar: {link_painel_pedido}\n\n— Equipe {nome_loja}'
where evento = 'pedido_novo' and canal = 'email';

update public.notification_templates set
  corpo = E'Novo pedido #{numero_pedido} — {nome_loja}.\nCliente: {nome_cliente}\nValor: {valor_total}\n\nValidar no painel: {link_painel_pedido}'
where evento = 'pedido_novo' and canal = 'whatsapp';

-- pedido_recebido (cliente)
update public.notification_templates set
  corpo = E'Olá, {nome_cliente}!\n\nRecebemos seu pedido #{numero_pedido} e em breve confirmaremos os detalhes.\n\nVocê pode acompanhar o andamento na sua área do cliente: {link_pedido}\n\nObrigado pela preferência!\n\n— Equipe {nome_loja}'
where evento = 'pedido_recebido' and canal = 'email';

update public.notification_templates set
  corpo = E'Olá, {nome_cliente}! Recebemos seu pedido #{numero_pedido} e em breve confirmaremos os detalhes. Acompanhe: {link_pedido}\n\n— Equipe {nome_loja}'
where evento = 'pedido_recebido' and canal = 'whatsapp';

-- pedido_validado (cliente)
update public.notification_templates set
  corpo = E'Olá, {nome_cliente}!\n\nSeu pedido #{numero_pedido} foi confirmado e já está sendo preparado.\n\nConfira os detalhes na sua área do cliente: {link_pedido}\n\nQualquer dúvida, é só chamar a gente.\n\n— Equipe {nome_loja}'
where evento = 'pedido_validado' and canal = 'email';

update public.notification_templates set
  corpo = E'Olá, {nome_cliente}! Seu pedido #{numero_pedido} foi confirmado. Detalhes: {link_pedido}\n\n— Equipe {nome_loja}'
where evento = 'pedido_validado' and canal = 'whatsapp';

-- pedido_ajustado (cliente)
update public.notification_templates set
  corpo = E'Olá, {nome_cliente}!\n\nSeu pedido #{numero_pedido} foi ajustado: um ou mais itens foram reduzidos ou removidos por falta de estoque.\n\nConfira o que mudou na sua área do cliente: {link_pedido}\n\nQualquer dúvida, é só chamar a gente.\n\n— Equipe {nome_loja}'
where evento = 'pedido_ajustado' and canal = 'email';

update public.notification_templates set
  corpo = E'Olá, {nome_cliente}! Seu pedido #{numero_pedido} foi ajustado: um ou mais itens foram reduzidos ou removidos por falta de estoque. Confira o que mudou: {link_pedido}\n\n— Equipe {nome_loja}'
where evento = 'pedido_ajustado' and canal = 'whatsapp';

-- pedido_cancelado (cliente)
update public.notification_templates set
  corpo = E'Olá, {nome_cliente}!\n\nSeu pedido #{numero_pedido} foi cancelado. Motivo: {motivo}\n\nConfira os detalhes na sua área do cliente: {link_pedido}\n\nQualquer dúvida, é só chamar a gente.\n\n— Equipe {nome_loja}'
where evento = 'pedido_cancelado' and canal = 'email';

update public.notification_templates set
  corpo = E'Olá, {nome_cliente}! Seu pedido #{numero_pedido} foi cancelado. Motivo: {motivo}\n\n— Equipe {nome_loja}'
where evento = 'pedido_cancelado' and canal = 'whatsapp';
