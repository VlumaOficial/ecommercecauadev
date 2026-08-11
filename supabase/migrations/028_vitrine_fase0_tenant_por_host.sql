-- =====================================================
-- Vitrine — Fase 0: fundação de tenant público (Opção C, decisão
-- registrada em ESCOPO_PROJETO.md §2, "requisito obrigatório da fase
-- Vitrine"). Pré-requisito de segurança que bloqueia toda a Vitrine —
-- nenhuma tela pública é construída antes disto existir e ser testado.
--
-- O que esta migration cria:
--   1. tabela `tenant_domains` — hostname -> tenant (1 tenant pode ter
--      vários domínios: subdomínio nosso + domínio próprio do cliente
--      simultaneamente, já pensando na Fase SaaS sem precisar migrar
--      o schema de novo).
--   2. RPC `resolve_tenant_by_host(p_host)` — único ponto que traduz
--      host -> tenant_id/slug. Chamada pelo proxy (src/proxy.ts,
--      código a implementar DEPOIS desta migration ser revisada/
--      aplicada) uma vez por request.
--   3. Quatro RPCs de leitura pública (`get_public_*`), todas
--      SECURITY DEFINER com o filtro de tenant DENTRO do corpo da
--      função — nunca dependem de RLS pra isolar (RLS não resolve
--      tenant de sessão anônima, é exatamente o gap que a Opção C
--      fecha). Cada uma recebe o SLUG já resolvido (nunca um host
--      cru, nunca um tenant_id vindo direto do client) e faz a
--      PRÓPRIA resolução slug -> tenant_id internamente — mesmo que
--      algum código futuro passe o slug errado, o pior caso é "sem
--      dado", nunca "dado de outro tenant".
--   4. Endurecimento das policies `*_select_anon` (migration 014):
--      dropadas. RLS nunca conseguiu isolar por tenant uma sessão
--      anônima (não tem JWT/claims pra resolver contra) — por isso
--      elas sempre foram `using (true)`, sem filtro nenhum, desde que
--      criadas. Ficaram assim de propósito "até a Vitrine existir"
--      (nota já registrada na 014 e em ESCOPO_PROJETO.md §2). A
--      Vitrine está começando agora: a partir desta migration, leitura
--      anônima só entra pelas RPCs acima — go embutido no runtime.
--
-- O que esta migration NÃO faz (fora do escopo da Fase 0):
--   - Não mexe em proxy.ts, tenant.ts nem em nenhuma tela da Vitrine
--     ((loja)/**) — isso é implementação de código, não migration, e
--     só acontece depois desta ser revisada e aplicada.
--   - Não popula tenant_domains com os hosts reais de teste
--     (ecommercecauahml.vluma.com.br / testeecommerce.vluma.com.br) —
--     ver bloco de SEED comentado no final, pra rodar manualmente só
--     depois de confirmar que testeecommerce.vluma.com.br está
--     apontado pro projeto Vercel (fora do escopo de uma migration).
--   - Não adiciona paginação/cache na resolução de host->tenant — Fase
--     0 aceita 1 query a mais por request; otimizar (cache em memória/
--     Edge Config) fica pra quando o tráfego justificar.
-- =====================================================

-- ---------- 1. tenant_domains ----------

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- sempre lowercase, sem porta (normalizado na escrita e checado de
  -- novo dentro da RPC de leitura, nunca confia só na normalização de
  -- quem inseriu a linha).
  dominio text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.tenant_domains is
  'Hostnames que resolvem pra um tenant (subdominio nosso padrao e/ou dominio proprio do cliente, ambos tratados igual - e apenas um match exato de host). Um tenant pode ter varias linhas. Sem RLS permissiva de proposito: acessivel apenas via funcoes SECURITY DEFINER, nunca direto por anon/authenticated - fecha a superficie de enumeracao de dominios.';

alter table public.tenant_domains enable row level security;
-- Nenhuma policy criada de proposito: nem anon nem authenticated tem
-- select/insert/update/delete direto nesta tabela. Toda leitura passa
-- por resolve_tenant_by_host() (abaixo); toda escrita (cadastro de
-- dominio novo) e' tarefa administrativa manual/futura RPC de staff,
-- fora do escopo da Fase 0.

-- ---------- 2. resolve_tenant_by_host ----------
-- Unico ponto que traduz host -> tenant. Normaliza (lowercase, tira
-- porta) tanto do lado de quem chama (proxy.ts fara' o mesmo antes de
-- passar) quanto aqui dentro, defensivamente - nunca confia so' numa
-- camada. Sem match exato = sem linha nenhuma devolvida (sem
-- fallback, sem "tenant default") - host desconhecido ou forjado
-- nunca resolve pra tenant nenhum.
create or replace function public.resolve_tenant_by_host(p_host text)
returns table (tenant_id uuid, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  where d.dominio = split_part(lower(trim(p_host)), ':', 1)
    and t.ativo = true
  limit 1;
$$;

comment on function public.resolve_tenant_by_host(text) is
  'Traduz host -> tenant (apenas match exato, sem fallback). Tenant inativo ou host nao cadastrado devolvem zero linhas de proposito - quem chama trata "nao encontrou" como 404, nunca como "usa um tenant padrao".';

grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated;

-- ---------- 3. RPCs de leitura publica ----------
-- Todas: SECURITY DEFINER, filtro de tenant resolvido DENTRO da
-- funcao a partir do slug (nunca aceitam tenant_id direto), stable
-- (sem efeito colateral, cacheavel dentro da transacao). Todas
-- devolvem vazio/null (nao erro) pra slug invalido/tenant inativo -
-- join contra tenants com ativo=true garante isso sem precisar de
-- `if`/exception em cada uma.

create or replace function public.get_public_store_settings(p_tenant_slug text)
returns table (
  nome text,
  loja_aberta boolean,
  pedidos_abertos boolean,
  mensagem_loja_fechada text,
  mensagem_pedidos_fechados text,
  valor_minimo_pedido numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.nome,
    s.loja_aberta,
    s.pedidos_abertos,
    s.mensagem_loja_fechada,
    s.mensagem_pedidos_fechados,
    s.valor_minimo_pedido
  from public.tenants t
  join public.store_settings s on s.tenant_id = t.id
  where t.slug = p_tenant_slug
    and t.ativo = true;
$$;

comment on function public.get_public_store_settings(text) is
  'Config publica da loja. De proposito NAO expoe: baixa_estoque_na_reserva, minutos_expiracao_reserva, permite_autocadastro - sao operacionais/internos, sem uso na vitrine.';

grant execute on function public.get_public_store_settings(text) to anon, authenticated;


create or replace function public.get_public_categories(p_tenant_slug text)
returns table (
  id uuid,
  nome text,
  slug text,
  parent_id uuid,
  ordem int
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive v_tenant as (
    select tn.id from public.tenants tn where tn.slug = p_tenant_slug and tn.ativo = true
  ),
  arvore as (
    -- raizes
    select c.id, c.nome, c.slug, c.parent_id, c.ordem, c.ativo as ramo_ativo
    from public.categories c
    where c.tenant_id = (select id from v_tenant) and c.parent_id is null
    union all
    -- descendentes: so' entra na arvore visivel se ELE e todo o ramo
    -- acima dele (ramo_ativo do pai) estiverem ativos - decisao #9 ja
    -- registrada (categoria inativa esconde a subarvore inteira da
    -- vitrine, mesmo que um filho tenha sido reativado individualmente
    -- sem recascatear o pai).
    select c.id, c.nome, c.slug, c.parent_id, c.ordem, (c.ativo and a.ramo_ativo)
    from public.categories c
    join arvore a on c.parent_id = a.id
    where c.tenant_id = (select id from v_tenant)
  )
  select id, nome, slug, parent_id, ordem
  from arvore
  where ramo_ativo
  order by ordem, nome;
$$;

comment on function public.get_public_categories(text) is
  'Arvore de categorias visiveis na vitrine - exclui categoria inativa E toda a subarvore dela (decisao #9), nao apenas a linha com ativo=false direto.';

grant execute on function public.get_public_categories(text) to anon, authenticated;


create or replace function public.get_public_products(
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
  'Listagem publica de produtos. De proposito NAO expoe saldo_estoque numerico - apenas o derivado "esgotado" (boolean). p_category_id filtra por match exato (nao inclui subcategorias) - filtro hierarquico fica como decisao de UI da vitrine, nao desta RPC.';

grant execute on function public.get_public_products(text, uuid) to anon, authenticated;


create or replace function public.get_public_product_detail(
  p_tenant_slug text,
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_resultado jsonb;
begin
  select id into v_tenant_id from public.tenants where slug = p_tenant_slug and ativo = true;
  if v_tenant_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'nome', p.nome,
    'slug', p.slug,
    'descricao', p.descricao,
    'category_id', p.category_id,
    'destaque', p.destaque,
    'codigo', case when p.codigo_visivel then p.codigo else null end,
    'unidade_venda', u.nome,
    'imagens', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'storage_path', pi.storage_path,
          'alt_text', pi.alt_text,
          'principal', pi.principal,
          'variant_id', pi.variant_id
        )
        order by pi.ordem
      )
      from public.product_images pi
      where pi.product_id = p.id
    ), '[]'::jsonb),
    'caracteristicas', coalesce((
      select jsonb_agg(
        jsonb_build_object('rotulo', ca.rotulo, 'valor', pav.valor)
        order by ca.ordem
      )
      from public.product_attribute_values pav
      join public.category_attributes ca on ca.id = pav.attribute_id
      where pav.product_id = p.id
        and ca.ativo = true
        and pav.valor is not null
        and pav.valor <> ''
    ), '[]'::jsonb),
    'variacoes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'nome', v.nome,
          'preco', v.preco,
          'preco_promocional', v.preco_promocional,
          -- boolean derivado, nunca o saldo_estoque cru - mesma
          -- decisao de "esconder numero exato" da listagem.
          'disponivel', v.saldo_estoque > 0,
          'quantidade_minima_venda', v.quantidade_minima_venda
        )
        order by v.ordem
      )
      from public.product_variants v
      where v.product_id = p.id and v.ativo = true
    ), '[]'::jsonb)
  )
  into v_resultado
  from public.products p
  join public.unidades_venda u on u.id = p.unidade_venda_id
  where p.tenant_id = v_tenant_id
    and p.slug = p_slug
    and p.ativo = true;

  return v_resultado;
end;
$$;

comment on function public.get_public_product_detail(text, text) is
  'Ficha do produto pra vitrine (URL por slug, nao id). De proposito NAO expoe: saldo_estoque numerico (apenas "disponivel" boolean por variacao), quantidade_minima_estoque (limiar interno de reposicao). Retorna null (nao erro) se produto/tenant nao existir ou nao estiver ativo - quem chama trata null como 404.';

grant execute on function public.get_public_product_detail(text, text) to anon, authenticated;


-- ---------- 4. Endurece as policies *_select_anon (migration 014) ----------
-- RLS nunca resolveu isolamento por tenant pra sessao anonima (sem
-- JWT/claims pra comparar contra tenant_id) - por isso essas 8
-- policies sempre foram "using (true)", abertas pra QUALQUER tenant,
-- desde que criadas na 014. Ficaram assim de proposito ate a Vitrine
-- existir (nota ja registrada na propria 014 e em
-- ESCOPO_PROJETO.md §2). A partir desta migration a leitura publica
-- passa a ser 100% pelas RPCs acima - deixar essas policies de pe'
-- seria um segundo caminho de leitura, tenant-blind, pro mesmo dado
-- (qualquer cliente com a anon key consegue chamar a REST API direto
-- na tabela, nao so' as RPCs) - exatamente a classe de risco que a
-- Opcao C existe pra fechar. Dropadas, nao substituidas por nada:
-- anon nao tem mais leitura direta de tabela nenhuma dessas 8 -
-- so' via RPC.
drop policy if exists "categories_select_anon" on public.categories;
drop policy if exists "category_attributes_select_anon" on public.category_attributes;
drop policy if exists "products_select_anon" on public.products;
drop policy if exists "product_variants_select_anon" on public.product_variants;
drop policy if exists "cities_select_anon" on public.delivery_cities;
drop policy if exists "settings_select_anon" on public.store_settings;
drop policy if exists "pfv_select_anon" on public.product_attribute_values;
drop policy if exists "images_select_anon" on public.product_images;

-- Nota: delivery_cities entra na lista acima porque tinha a mesma
-- policy tenant-blind da 014, mas NAO tem RPC publica nesta migration
-- (a vitrine ainda nao decidiu como expor cidades de entrega - fica
-- pra quando o Carrinho/Checkout for desenhado). Efeito pratico
-- imediato: leitura anonima de cidades de entrega fica fechada por
-- completo ate essa RPC existir - sem regressao visivel hoje porque
-- nenhuma tela publica consulta isso ainda.


-- ---------- SEED de teste (NAO roda automatico - comentado de proposito) ----------
-- Rodar manualmente so' depois de confirmar no Vercel que
-- testeecommerce.vluma.com.br esta' apontado pro mesmo projeto/deploy
-- (fora do escopo desta migration - configuracao de dominio, nao
-- schema). ecommercecauahml.vluma.com.br fica associado ao tenant
-- 'capua' de qualquer forma (precisa existir pra Fase 0 nao quebrar
-- nada). O canario '_teste_isolamento' precisa de ativo=true
-- TEMPORARIO pra esse teste especifico (ele nasce ativo=false de
-- proposito, "nao e' loja real" - ver supabase/tests/isolamento_test.sql)
-- - reverter pra false depois do teste de isolamento da Vitrine, mesmo
-- padrao ja usado no teste do JWT expiry (ajusta, testa, reverte).
--
-- insert into public.tenant_domains (tenant_id, dominio)
-- select id, 'ecommercecauahml.vluma.com.br' from public.tenants where slug = 'capua'
-- on conflict (dominio) do nothing;
--
-- insert into public.tenant_domains (tenant_id, dominio)
-- select id, 'testeecommerce.vluma.com.br' from public.tenants where slug = '_teste_isolamento'
-- on conflict (dominio) do nothing;
--
-- update public.tenants set ativo = true where slug = '_teste_isolamento';
-- -- ... rodar o teste de isolamento da Vitrine aqui ...
-- update public.tenants set ativo = false where slug = '_teste_isolamento';
