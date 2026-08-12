/**
 * Resolucao de tenant.
 *
 * Painel (staff): continua single-tenant hardcoded via env
 * (NEXT_PUBLIC_TENANT_SLUG) - nao depende de host, o isolamento real
 * do painel e' via current_tenant_id() no banco (profiles.tenant_id
 * do usuario logado, resolvido pela sessao). getTenantSlug() existe
 * so' pro que o codigo do painel ainda vier a precisar de um slug
 * fixo (hoje nenhum call site usa).
 *
 * Vitrine (publico): tenant resolvido POR HOST em src/proxy.ts (RPC
 * resolve_tenant_by_host, migration 028), anexado como headers
 * x-tenant-id/x-tenant-slug no request. getTenantFromHeaders() le
 * esses headers - server-only (Server Component ou Route Handler),
 * nunca client component. Host sem match em tenant_domains = headers
 * ausentes = retorna null - a PAGINA da Vitrine que chamar isso e'
 * quem decide 404, o proxy nunca bloqueia por causa de tenant.
 */

import { headers } from 'next/headers'

export const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'capua'

export function getTenantSlug(): string {
  return TENANT_SLUG
}

export type TenantResolvido = {
  id: string
  slug: string
}

// So' pra Vitrine ((loja)/**, ainda nao construida) - nunca chamar em
// codigo do painel, que nao depende de host nenhum.
export async function getTenantFromHeaders(): Promise<TenantResolvido | null> {
  const h = await headers()
  const id = h.get('x-tenant-id')
  const slug = h.get('x-tenant-slug')
  if (!id || !slug) return null
  return { id, slug }
}
