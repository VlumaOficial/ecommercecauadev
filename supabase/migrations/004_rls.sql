-- =====================================================
-- F2 - Row Level Security
-- Projeto: Criatorio Capua
--
-- Principios:
--   * Catalogo ativo: leitura publica (loja aberta ao visitante)
--   * Escrita no catalogo: apenas staff (admin/operador)
--   * Dados de cliente: proprio cliente + staff
--   * Configuracoes: leitura publica, escrita apenas admin
--   * Perfis internos: apenas staff
-- =====================================================

-- ---------- Habilitar RLS ----------
alter table public.tenants               enable row level security;
alter table public.profiles              enable row level security;
alter table public.customers             enable row level security;
alter table public.store_settings        enable row level security;
alter table public.categories            enable row level security;
alter table public.subcategories         enable row level security;
alter table public.subcategory_fields    enable row level security;
alter table public.products              enable row level security;
alter table public.product_field_values  enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_price_history enable row level security;

-- =====================================================
-- tenants
-- =====================================================
drop policy if exists "tenants_select_public" on public.tenants;
create policy "tenants_select_public" on public.tenants
  for select to anon, authenticated using (ativo = true);

drop policy if exists "tenants_admin_all" on public.tenants;
create policy "tenants_admin_all" on public.tenants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================
-- profiles (equipe interna)
-- =====================================================
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================
-- customers (cliente final)
-- =====================================================
drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_staff());

drop policy if exists "customers_insert_self" on public.customers;
create policy "customers_insert_self" on public.customers
  for insert to authenticated
  with check (auth_user_id = auth.uid() or public.is_staff());

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_staff())
  with check (auth_user_id = auth.uid() or public.is_staff());

drop policy if exists "customers_delete_admin" on public.customers;
create policy "customers_delete_admin" on public.customers
  for delete to authenticated using (public.is_admin());

-- =====================================================
-- store_settings
-- =====================================================
drop policy if exists "settings_select_public" on public.store_settings;
create policy "settings_select_public" on public.store_settings
  for select to anon, authenticated using (true);

drop policy if exists "settings_admin_write" on public.store_settings;
create policy "settings_admin_write" on public.store_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================
-- categories
-- =====================================================
drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public" on public.categories
  for select to anon, authenticated using (ativo = true or public.is_staff());

drop policy if exists "categories_staff_write" on public.categories;
create policy "categories_staff_write" on public.categories
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =====================================================
-- subcategories
-- =====================================================
drop policy if exists "subcategories_select_public" on public.subcategories;
create policy "subcategories_select_public" on public.subcategories
  for select to anon, authenticated using (ativo = true or public.is_staff());

drop policy if exists "subcategories_staff_write" on public.subcategories;
create policy "subcategories_staff_write" on public.subcategories
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =====================================================
-- subcategory_fields
-- =====================================================
drop policy if exists "fields_select_public" on public.subcategory_fields;
create policy "fields_select_public" on public.subcategory_fields
  for select to anon, authenticated using (ativo = true or public.is_staff());

drop policy if exists "fields_staff_write" on public.subcategory_fields;
create policy "fields_staff_write" on public.subcategory_fields
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =====================================================
-- products
-- =====================================================
drop policy if exists "products_select_public" on public.products;
create policy "products_select_public" on public.products
  for select to anon, authenticated using (ativo = true or public.is_staff());

drop policy if exists "products_staff_write" on public.products;
create policy "products_staff_write" on public.products
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =====================================================
-- product_field_values
-- =====================================================
drop policy if exists "pfv_select_public" on public.product_field_values;
create policy "pfv_select_public" on public.product_field_values
  for select to anon, authenticated using (true);

drop policy if exists "pfv_staff_write" on public.product_field_values;
create policy "pfv_staff_write" on public.product_field_values
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =====================================================
-- product_images
-- =====================================================
drop policy if exists "images_select_public" on public.product_images;
create policy "images_select_public" on public.product_images
  for select to anon, authenticated using (true);

drop policy if exists "images_staff_write" on public.product_images;
create policy "images_staff_write" on public.product_images
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =====================================================
-- product_price_history (somente staff, insercao via trigger)
-- =====================================================
drop policy if exists "price_history_staff_select" on public.product_price_history;
create policy "price_history_staff_select" on public.product_price_history
  for select to authenticated using (public.is_staff());
