-- =====================================================
-- Fase 2 (Carrinho/Checkout) — incremento 1: RPC pública
-- `get_public_delivery_cities`.
--
-- Pré-requisito identificado desde a Vitrine Fase 0 (migration 028):
-- aquela migration dropou a policy `cities_select_anon` (tenant-blind,
-- junto com as outras 7) mas NÃO criou RPC pública equivalente —
-- decisão deliberada na época, registrada no próprio comentário da
-- 028: "a vitrine ainda não decidiu como expor cidades de entrega,
-- fica pra quando o Carrinho/Checkout for desenhado". O Carrinho está
-- sendo desenhado agora (ESCOPO_PROJETO.md §0 itens 31/34,
-- REGRAS_DE_NEGOCIO.md §5/§11.7) — esta migration fecha essa
-- pendência (roteiro item 1 de 8, item 34/ponto 8).
--
-- Efeito sem esta migration: leitura anônima de `delivery_cities`
-- está completamente fechada desde a 028 (nem tabela, nem RPC) — o
-- visitante anônimo não consegue ver nenhuma cidade de entrega, o
-- checkout não teria como oferecer o seletor.
--
-- Segue EXATAMENTE o mesmo padrão das 4 RPCs públicas da migration
-- 028 (`get_public_store_settings`/`get_public_categories`/
-- `get_public_products`/`get_public_product_detail`): SECURITY
-- DEFINER, stable, search_path fixo, filtro de tenant resolvido
-- INTERNAMENTE a partir do slug (nunca aceita tenant_id vindo de
-- fora), devolve vazio (não erro) pra slug inválido/tenant inativo —
-- join contra `tenants` com `ativo = true` garante isso sem precisar
-- de `if`/exception.
--
-- Colunas expostas: id, nome, uf, ponto_entrega, horario,
-- observacoes, ordem — exatamente o que a tela de cidades do painel
-- já usa/mostra hoje (`/api/painel/cidades`, mesma ordenação
-- `ordem, nome`). `id` é necessário pro checkout referenciar a
-- cidade escolhida (mesmo padrão já usado por `customers.
-- delivery_city_id`, migration 005). De propósito NÃO expõe:
-- tenant_id (interno, multi-tenant não é assunto do cliente final),
-- ativo (a RPC já filtra só as ativas — devolver um campo que seria
-- sempre `true` não agrega nada), created_at/updated_at (metadado
-- interno, sem uso na vitrine/checkout). Nenhum dado sensível: são
-- as mesmas informações que já ficam públicas hoje na conversa manual
-- por WhatsApp (nome da cidade, ponto de encontro, horário,
-- observações).
--
-- Puramente aditiva: cria função nova, não altera nenhuma tabela,
-- policy ou função existente. Nada quebra.
--
-- Frontend/consumo (seletor de cidade no checkout) fica pra um
-- incremento seguinte do roteiro da Fase 2 — esta migration só cria
-- a RPC no banco.
-- =====================================================

create or replace function public.get_public_delivery_cities(p_tenant_slug text)
returns table (
  id uuid,
  nome text,
  uf text,
  ponto_entrega text,
  horario text,
  observacoes text,
  ordem int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.nome,
    c.uf,
    c.ponto_entrega,
    c.horario,
    c.observacoes,
    c.ordem
  from public.delivery_cities c
  join public.tenants t on t.id = c.tenant_id
  where t.slug = p_tenant_slug
    and t.ativo = true
    and c.ativo = true
  order by c.ordem, c.nome;
$$;

comment on function public.get_public_delivery_cities(text) is
  'Cidades de entrega ATIVAS de um tenant, pra vitrine/checkout (Fase 2, incremento 1). De proposito NAO expoe: tenant_id (interno), ativo (ja filtrado, sempre true no retorno), created_at/updated_at (metadado interno). Mesmo padrao SECURITY DEFINER das outras RPCs publicas (migration 028) - resolve o tenant internamente a partir do slug, nunca aceita tenant_id vindo de fora; slug invalido ou tenant inativo devolvem zero linhas, nao erro.';

grant execute on function public.get_public_delivery_cities(text) to anon, authenticated;
