-- =====================================================
-- Fecha vazamento de leitura cross-tenant confirmado em teste real
-- (Opção A da decisão de arquitetura — ver ESCOPO_PROJETO.md §2,
-- decisão #21, revisão de 31/07/2026).
--
-- Achado: rodando supabase/tests/isolamento_test.sql após a migration
-- 013 (isolamento) aplicada, o staff do tenant sintético de teste
-- enxergava as categorias ATIVAS do Cauã (6 linhas vazando). Causa
-- raiz: as policies "*_select_public" criadas/corrigidas na 013
-- valiam para "anon, authenticated" com a MESMA condição
-- "ativo = true or (is_staff() and tenant_id = current_tenant_id())".
-- RLS faz OR entre policies permissivas aplicáveis ao mesmo comando —
-- então a branch "ativo = true" (sem filtro de tenant nenhum) sozinha
-- já garantia visibilidade de QUALQUER linha ativa de QUALQUER tenant
-- para QUALQUER sessão authenticated, não só anon. A branch de staff
-- tenant-scoped era redundante, nunca chegava a restringir nada.
--
-- A branch de ESCRITA (*_staff_write, "for all") NÃO tinha esse
-- problema — "for select" nunca é consultada em INSERT/UPDATE/DELETE,
-- só em SELECT — por isso o teste de escrita cross-tenant já dava
-- 0 linhas afetadas antes desta migration. O vazamento era só leitura.
--
-- Fix: separar a policy de SELECT em duas por tabela:
--   - anon: mantém "ativo = true" — pensada pra vitrine pública
--     (ainda não construída). RLS não consegue resolver tenant de uma
--     sessão anônima (sem JWT/sessão, current_tenant_id() não
--     resolve nada); isolamento de leitura pública continua
--     responsabilidade da query da aplicação até a Vitrine existir —
--     ver Opção C registrada em ESCOPO_PROJETO.md §2 (RPC/view
--     parametrizada por tenant, requisito da fase Vitrine).
--   - authenticated: SEMPRE "tenant_id = current_tenant_id()", sem
--     nenhum escape hatch. Fecha o vazamento tanto pra STAFF quanto
--     pra CLIENTE FINAL LOGADO (achado extra desta sessão: um cliente
--     autenticado também conseguia ver catálogo ativo de outro tenant
--     antes desta correção).
--
-- Tabelas sem coluna "ativo" (store_settings, product_attribute_values,
-- product_images — hoje "using (true)" puro): não têm o conceito de
-- linha ativa/inativa, então a policy authenticated fica só
-- "tenant_id = current_tenant_id()", sem branch de is_staff() (não há
-- "staff vê inativo também" pra aplicar aqui).
--
-- Preenche o número 014, que ficou vago na renumeração registrada em
-- docs/MIGRATIONS.md (013 -> 015, 014 -> 016 na sessão anterior, pra
-- dar lugar à migration 013 de isolamento).
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- categories ----------
drop policy if exists "categories_select_public" on public.categories;
drop policy if exists "categories_select_anon" on public.categories;
drop policy if exists "categories_select_authenticated" on public.categories;

create policy "categories_select_anon" on public.categories
  for select to anon
  using (ativo = true);

create policy "categories_select_authenticated" on public.categories
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and (ativo = true or public.is_staff()));

-- ---------- category_attributes ----------
drop policy if exists "category_attributes_select_public" on public.category_attributes;
drop policy if exists "category_attributes_select_anon" on public.category_attributes;
drop policy if exists "category_attributes_select_authenticated" on public.category_attributes;

create policy "category_attributes_select_anon" on public.category_attributes
  for select to anon
  using (ativo = true);

create policy "category_attributes_select_authenticated" on public.category_attributes
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and (ativo = true or public.is_staff()));

-- ---------- products ----------
drop policy if exists "products_select_public" on public.products;
drop policy if exists "products_select_anon" on public.products;
drop policy if exists "products_select_authenticated" on public.products;

create policy "products_select_anon" on public.products
  for select to anon
  using (ativo = true);

create policy "products_select_authenticated" on public.products
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and (ativo = true or public.is_staff()));

-- ---------- product_variants ----------
drop policy if exists "product_variants_select_public" on public.product_variants;
drop policy if exists "product_variants_select_anon" on public.product_variants;
drop policy if exists "product_variants_select_authenticated" on public.product_variants;

create policy "product_variants_select_anon" on public.product_variants
  for select to anon
  using (ativo = true);

create policy "product_variants_select_authenticated" on public.product_variants
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and (ativo = true or public.is_staff()));

-- ---------- delivery_cities ----------
drop policy if exists "cities_select_public" on public.delivery_cities;
drop policy if exists "cities_select_anon" on public.delivery_cities;
drop policy if exists "cities_select_authenticated" on public.delivery_cities;

create policy "cities_select_anon" on public.delivery_cities
  for select to anon
  using (ativo = true);

create policy "cities_select_authenticated" on public.delivery_cities
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and (ativo = true or public.is_staff()));

-- ---------- store_settings (sem coluna "ativo": config 1x por tenant) ----------
drop policy if exists "settings_select_public" on public.store_settings;
drop policy if exists "settings_select_anon" on public.store_settings;
drop policy if exists "settings_select_authenticated" on public.store_settings;

create policy "settings_select_anon" on public.store_settings
  for select to anon
  using (true);

create policy "settings_select_authenticated" on public.store_settings
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- ---------- product_attribute_values (sem coluna "ativo" própria) ----------
drop policy if exists "pfv_select_public" on public.product_attribute_values;
drop policy if exists "pfv_select_anon" on public.product_attribute_values;
drop policy if exists "pfv_select_authenticated" on public.product_attribute_values;

create policy "pfv_select_anon" on public.product_attribute_values
  for select to anon
  using (true);

create policy "pfv_select_authenticated" on public.product_attribute_values
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- ---------- product_images (sem coluna "ativo" própria) ----------
drop policy if exists "images_select_public" on public.product_images;
drop policy if exists "images_select_anon" on public.product_images;
drop policy if exists "images_select_authenticated" on public.product_images;

create policy "images_select_anon" on public.product_images
  for select to anon
  using (true);

create policy "images_select_authenticated" on public.product_images
  for select to authenticated
  using (tenant_id = public.current_tenant_id());
