-- =====================================================
-- products e product_variants: tenant_id ganha DEFAULT via current_tenant_id()
-- Mesmo motivo das 008/010/012 (delivery_cities, categories,
-- category_attributes). Gap ficou para tras desde a 003 (products) e
-- 009 (product_variants) - so notado agora, planejando o CRUD de Produtos.
-- Projeto: Criatorio Capua
-- =====================================================

alter table public.products
  alter column tenant_id set default public.current_tenant_id();

alter table public.product_variants
  alter column tenant_id set default public.current_tenant_id();
