-- =====================================================
-- category_attributes.tenant_id ganha DEFAULT via current_tenant_id()
-- Mesmo motivo da 008 (delivery_cities) e 010 (categories): sem isso,
-- o INSERT feito pelo Route Handler de Caracteristicas precisaria
-- descobrir e enviar o tenant_id manualmente, quebrando o modelo
-- multi-tenant.
-- Projeto: Criatorio Capua
-- =====================================================

alter table public.category_attributes
  alter column tenant_id set default public.current_tenant_id();
