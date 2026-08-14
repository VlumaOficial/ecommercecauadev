-- Vitrine: indicador de faixa de preco em get_public_products, pro
-- padrao de mercado "a partir de X" so aparecer quando o produto tem
-- variacoes ativas com precos diferentes (Shopify e afins). Hoje a
-- RPC so devolve o menor preco (preco_a_partir_de = min(v.preco)),
-- sem informar se ha faixa - a UI nao tem como saber se e' seguro
-- mostrar "a partir de" sem mudar de significado (preco unico
-- mostrando "a partir de" seria enganoso).
--
-- Muda o RETURNS TABLE (coluna nova preco_varia) com a MESMA
-- assinatura de entrada (p_tenant_slug text, p_category_id uuid) -
-- Postgres nao aceita CREATE OR REPLACE quando o retorno muda (erro
-- "cannot change return type of existing function"), diferente do
-- caso de mudar parametros de entrada (que cria overload em vez de
-- substituir - licao ja registrada em sessoes anteriores). Por isso
-- precisa DROP antes.

drop function if exists public.get_public_products(text, uuid);

create function public.get_public_products(
  p_tenant_slug text,
  p_category_id uuid default null
)
returns table (
  id uuid,
  nome text,
  slug text,
  descricao text,
  category_id uuid,
  destaque boolean,
  novidade boolean,
  em_promocao boolean,
  esgotado boolean,
  preco_a_partir_de numeric,
  preco_varia boolean,
  codigo text,
  imagem_principal text,
  unidade_venda text
)
language sql
stable
security definer
set search_path = public
as $$
  with v_tenant as (
    select tn.id from public.tenants tn where tn.slug = p_tenant_slug and tn.ativo = true
  )
  select
    p.id,
    p.nome,
    p.slug,
    p.descricao,
    p.category_id,
    p.destaque,
    p.created_at > now() - interval '30 days' as novidade,
    bool_or(v.ativo and v.preco_promocional is not null and v.preco_promocional < v.preco) as em_promocao,
    coalesce(sum(v.saldo_estoque) filter (where v.ativo), 0) = 0 as esgotado,
    min(v.preco) filter (where v.ativo) as preco_a_partir_de,
    -- true so' quando ha 2+ variacoes ativas com preco BASE (v.preco,
    -- nao o promocional) diferente entre si - "is distinct from" trata
    -- null corretamente (produto sem nenhuma variacao ativa: min/max
    -- ambos null, is distinct from null = false, nao null).
    (max(v.preco) filter (where v.ativo) is distinct from min(v.preco) filter (where v.ativo)) as preco_varia,
    -- codigo so' aparece se o lojista ligou "codigo visivel" pro
    -- produto (decisao #18, ja existia antes da vitrine) - nunca
    -- exposto por padrao.
    case when p.codigo_visivel then p.codigo else null end as codigo,
    (
      select pi.storage_path
      from public.product_images pi
      where pi.product_id = p.id and pi.principal = true and pi.variant_id is null
      limit 1
    ) as imagem_principal,
    u.nome as unidade_venda
  from public.products p
  join public.unidades_venda u on u.id = p.unidade_venda_id
  left join public.product_variants v on v.product_id = p.id
  where p.tenant_id = (select id from v_tenant)
    and p.ativo = true
    and (p_category_id is null or p.category_id = p_category_id)
  group by p.id, p.nome, p.slug, p.descricao, p.category_id, p.destaque, p.created_at, p.codigo_visivel, p.codigo, u.nome
  order by p.ordem, p.nome;
$$;

comment on function public.get_public_products(text, uuid) is
  'Listagem publica de produtos. De proposito NAO expoe saldo_estoque numerico - apenas o derivado "esgotado" (boolean). preco_varia indica se ha faixa de preco entre variacoes ativas (preco base, nao considera promocional) - UI so mostra "a partir de" quando true, padrao de mercado. p_category_id filtra por match exato (nao inclui subcategorias) - filtro hierarquico fica como decisao de UI da vitrine, nao desta RPC.';

grant execute on function public.get_public_products(text, uuid) to anon, authenticated;
