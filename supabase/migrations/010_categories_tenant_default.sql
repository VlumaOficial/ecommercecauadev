-- =====================================================
-- categories.tenant_id ganha DEFAULT via current_tenant_id()
-- Mesmo motivo da 008 (delivery_cities): sem isso, o INSERT feito
-- pelo Route Handler do CRUD de Categorias precisaria descobrir e
-- enviar o tenant_id manualmente, quebrando o modelo multi-tenant.
-- Projeto: Criatorio Capua
-- =====================================================

alter table public.categories
  alter column tenant_id set default public.current_tenant_id();
