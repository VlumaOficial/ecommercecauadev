-- =====================================================
-- Remove a coluna antiga products.unidade_venda (texto livre), agora
-- que products.unidade_venda_id (019) esta preenchida, obrigatoria e
-- em uso pelas RPCs de criar/atualizar produto.
--
-- Separada de proposito da 019 (decisao do usuario, sessao de
-- 01/08/2026): aplicar SOMENTE depois de confirmar em produção que a
-- selecao de unidade (combobox) funciona ponta a ponta - criar
-- produto, editar produto, listagem - com dados reais. Ate la, a
-- coluna antiga fica no banco sem uso (nao e mais lida nem escrita
-- por nenhuma RPC desde a 019), sem risco de quebrar nada, servindo
-- de rede de seguranca caso algo precise ser conferido contra o valor
-- de texto original antes do backfill.
--
-- IRREVERSIVEL: uma vez aplicada, o texto livre original de cada
-- produto (ex.: "und", "unid.", o que quer que tenha sido digitado
-- antes desta feature) e perdido para sempre - so resta o vinculo
-- normalizado via unidade_venda_id. Nao aplicar sem confirmar antes
-- que o backfill da 019 ficou correto.
-- Projeto: Criatorio Capua
-- =====================================================

alter table public.products
  drop column if exists unidade_venda;
