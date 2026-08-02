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
--
-- Correcao (1a tentativa de aplicacao falhou, 01/08/2026): a view
-- `products_com_status` (009, redefinida na 016) foi criada com
-- `p.*`, que o Postgres expande e FIXA na lista de colunas de
-- `products` no momento da criacao da view - ela nao "olha" a tabela
-- dinamicamente depois. Por isso o Postgres recusa o DROP COLUMN com
-- "cannot drop column unidade_venda ... view products_com_status
-- depends on it" (2BP01). Precisa dropar e recriar a view na mesma
-- migration (mesmo padrao ja usado na 016 pro mesmo motivo - CREATE OR
-- REPLACE VIEW so aceita ACRESCENTAR coluna, nao remover).
--
-- ATENCAO CRITICA: ao recriar a view, o `security_invoker = true` da
-- migration 018 (fecha vazamento cross-tenant na leitura via view -
-- sem isso a view ignora RLS) precisa ser declarado de novo na propria
-- CREATE VIEW. Um DROP+CREATE novo NAO herda reloptions da view
-- antiga - se essa linha for esquecida aqui, o vazamento da 018 volta
-- a existir silenciosamente. Ver ESCOPO_PROJETO.md §2 (terceiro
-- vazamento) e docs/MIGRATIONS.md (migration 018).
-- Projeto: Criatorio Capua
-- =====================================================

drop view if exists public.products_com_status;

alter table public.products
  drop column if exists unidade_venda;

create view public.products_com_status
with (security_invoker = true)
as
select
  p.*,
  c.nome as categoria_nome,
  coalesce(sum(v.saldo_estoque) filter (where v.ativo), 0) as estoque_total,
  coalesce(sum(v.saldo_estoque) filter (where v.ativo), 0) = 0 as esgotado,
  bool_or(v.ativo and v.preco_promocional is not null and v.preco_promocional < v.preco) as em_promocao,
  min(v.preco) filter (where v.ativo) as preco_a_partir_de,
  p.created_at > now() - interval '30 days' as novidade
from public.products p
join public.categories c on c.id = p.category_id
left join public.product_variants v on v.product_id = p.id
group by p.id, c.nome;
