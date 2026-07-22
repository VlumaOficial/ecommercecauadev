/**
 * Resolucao de tenant.
 *
 * MVP: single-tenant, retorna slug fixo da env.
 * Futuro multi-tenant: ler subdominio do host e resolver via banco.
 * TODA logica de tenant deve passar por este modulo.
 */

export const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'capua'

export function getTenantSlug(): string {
  return TENANT_SLUG
}

export function getTenantSlugFromHost(host?: string | null): string {
  // Futuro: extrair subdominio de `host` e validar contra tabela tenants.
  void host
  return TENANT_SLUG
}
