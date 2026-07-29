-- =====================================================
-- delivery_cities.tenant_id ganha DEFAULT via current_tenant_id()
-- Sem isso, todo INSERT feito pelo client precisaria descobrir e
-- enviar o tenant_id manualmente (ex.: hardcode do slug 'capua'),
-- o que quebra o modelo multi-tenant. current_tenant_id() (definida
-- em 002_core.sql) ja resolve isso a partir do usuario autenticado.
-- Projeto: Criatorio Capua
-- =====================================================

alter table public.delivery_cities
  alter column tenant_id set default public.current_tenant_id();
