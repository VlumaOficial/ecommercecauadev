-- =====================================================
-- Isolamento total por tenant (decisao #21, ESCOPO_PROJETO.md)
--
-- Gap corrigido: is_admin()/is_staff() (002_core.sql) sao checagens
-- GLOBAIS, nao filtram por tenant_id. Toda policy de escrita/leitura
-- privilegiada que dependia só dessas funcoes permitia staff/admin de
-- um tenant ler ou escrever dados de OUTRO tenant. Inofensivo ate
-- agora porque so existe 1 tenant (capua); esta migration fecha o gap
-- antes de qualquer feature nova (Produtos) ou de um 2o tenant existir.
--
-- Padrao de correcao: toda condicao "is_staff()"/"is_admin()" ganha
-- "and tenant_id = current_tenant_id()". O acesso a propria linha
-- (auth_user_id = auth.uid() / id = auth.uid()) NAO muda -- ja e
-- seguro por natureza, nao depende de checagem de tenant.
--
-- O que fica de fora, de proposito:
--   - Leitura publica (anon) de storefront (categories_select_public,
--     products_select_public, settings_select_public, etc.): RLS nao
--     consegue restringir por tenant um visitante anonimo (sem sessao,
--     current_tenant_id() nao resolve nada pra ele). Isolamento de
--     leitura publica tem que ser feito na QUERY DA APLICACAO
--     (.eq('tenant_id', tenantResolvidoPeloSubdominio) via
--     src/lib/tenant.ts), nao aqui. Vale em especial pra
--     store_settings (settings_select_public usa "using (true)",
--     devolve a config de TODOS os tenants pra qualquer anon) -- fica
--     assim ate a Vitrine existir; quando existir, a query da Vitrine
--     que le store_settings tem que filtrar por tenant explicitamente,
--     do contrario devolve a config errada. Registrado tambem em
--     ESCOPO_PROJETO.md §2.
--   - handle_new_user() (006): hardcoda tenant='capua' no signup. Nao
--     e vazamento (nao expoe dado de outro tenant), e uma premissa
--     single-tenant deliberada do MVP -- vira tema da Fase SaaS
--     (decisao #22, resolver tenant pelo contexto do cadastro/
--     subdominio), nao desta migration de isolamento.
--   - subcategories / subcategory_fields: tabelas dropadas na 009,
--     nada a corrigir.
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- tenants ----------
-- Admin de um tenant só pode alterar o PRÓPRIO tenant (não qualquer
-- linha de public.tenants). Leitura publica (tenants_select_public)
-- fica como esta -- é diretório básico (nome/slug de tenants ativos).
drop policy if exists "tenants_admin_all" on public.tenants;
create policy "tenants_admin_all" on public.tenants
  for all to authenticated
  using (public.is_admin() and id = public.current_tenant_id())
  with check (public.is_admin() and id = public.current_tenant_id());

-- ---------- profiles ----------
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (id = auth.uid() or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_admin() and tenant_id = public.current_tenant_id());

-- ---------- customers ----------
drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers
  for select to authenticated
  using (auth_user_id = auth.uid() or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "customers_insert_self" on public.customers;
create policy "customers_insert_self" on public.customers
  for insert to authenticated
  with check (auth_user_id = auth.uid() or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers
  for update to authenticated
  using (auth_user_id = auth.uid() or (public.is_staff() and tenant_id = public.current_tenant_id()))
  with check (auth_user_id = auth.uid() or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "customers_delete_admin" on public.customers;
create policy "customers_delete_admin" on public.customers
  for delete to authenticated
  using (public.is_admin() and tenant_id = public.current_tenant_id());

-- ---------- store_settings ----------
-- settings_select_public NAO muda (using (true) -- ver nota de anon/
-- vitrine no topo do arquivo). Só a escrita fica restrita ao proprio tenant.
drop policy if exists "settings_admin_write" on public.store_settings;
create policy "settings_admin_write" on public.store_settings
  for all to authenticated
  using (public.is_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_admin() and tenant_id = public.current_tenant_id());

-- ---------- categories ----------
drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public" on public.categories
  for select to anon, authenticated
  using (ativo = true or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "categories_staff_write" on public.categories;
create policy "categories_staff_write" on public.categories
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- category_attributes ----------
drop policy if exists "category_attributes_select_public" on public.category_attributes;
create policy "category_attributes_select_public" on public.category_attributes
  for select to anon, authenticated
  using (ativo = true or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "category_attributes_staff_write" on public.category_attributes;
create policy "category_attributes_staff_write" on public.category_attributes
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- products ----------
drop policy if exists "products_select_public" on public.products;
create policy "products_select_public" on public.products
  for select to anon, authenticated
  using (ativo = true or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "products_staff_write" on public.products;
create policy "products_staff_write" on public.products
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- product_variants ----------
drop policy if exists "product_variants_select_public" on public.product_variants;
create policy "product_variants_select_public" on public.product_variants
  for select to anon, authenticated
  using (ativo = true or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "product_variants_staff_write" on public.product_variants;
create policy "product_variants_staff_write" on public.product_variants
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- product_attribute_values (renomeada de product_field_values na 009) ----------
-- pfv_select_public NAO muda (using (true) -- dado de vitrine, sem
-- conceito proprio de "ativo"). Só a escrita fica restrita ao tenant.
drop policy if exists "pfv_staff_write" on public.product_attribute_values;
create policy "pfv_staff_write" on public.product_attribute_values
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- product_images ----------
-- images_select_public NAO muda (using (true) -- mesma razao acima).
drop policy if exists "images_staff_write" on public.product_images;
create policy "images_staff_write" on public.product_images
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- product_price_history ----------
drop policy if exists "price_history_staff_select" on public.product_price_history;
create policy "price_history_staff_select" on public.product_price_history
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- delivery_cities ----------
drop policy if exists "cities_select_public" on public.delivery_cities;
create policy "cities_select_public" on public.delivery_cities
  for select to anon, authenticated
  using (ativo = true or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists "cities_staff_write" on public.delivery_cities;
create policy "cities_staff_write" on public.delivery_cities
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- =====================================================
-- RPC set_category_ativo_cascade (migration 011, JA APLICADA):
-- gap real, ja em producao -- so checava is_staff(), sem checar se
-- p_category_id pertence ao tenant do chamador. Um category_id de
-- outro tenant seria aceito e cascatearia normalmente (SECURITY
-- DEFINER ignora RLS, entao a checagem tem que estar aqui dentro).
-- create or replace: comportamento identico pra quem so tem 1 tenant
-- (v_tenant_id sempre bate), so passa a rejeitar category_id de fora.
-- =====================================================
create or replace function public.set_category_ativo_cascade(
  p_category_id uuid,
  p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  v_tenant_id := public.current_tenant_id();

  if not exists (
    select 1 from public.categories where id = p_category_id and tenant_id = v_tenant_id
  ) then
    raise exception 'Categoria não encontrada.';
  end if;

  if p_ativo = false then
    update public.categories
    set ativo = false, inativado_em_cascata = false
    where id = p_category_id and tenant_id = v_tenant_id;

    with recursive descendentes as (
      select id from public.categories where parent_id = p_category_id and tenant_id = v_tenant_id
      union all
      select c.id from public.categories c
        join descendentes d on c.parent_id = d.id
      where c.tenant_id = v_tenant_id
    )
    update public.categories c
    set ativo = false, inativado_em_cascata = true
    from descendentes d
    where c.id = d.id and c.ativo = true;
  else
    update public.categories
    set ativo = true, inativado_em_cascata = false
    where id = p_category_id and tenant_id = v_tenant_id;

    with recursive descendentes as (
      select id from public.categories where parent_id = p_category_id and tenant_id = v_tenant_id
      union all
      select c.id from public.categories c
        join descendentes d on c.parent_id = d.id
      where c.tenant_id = v_tenant_id
    )
    update public.categories c
    set ativo = true, inativado_em_cascata = false
    from descendentes d
    where c.id = d.id and c.inativado_em_cascata = true;
  end if;
end;
$$;
