import { createPublicClient } from '@/lib/supabase/public'
import type {
  CategoriaPublica,
  ProdutoDetalhe,
  ProdutoPublico,
  StoreSettingsPublico,
} from '@/lib/loja/types'

// Wrappers finos sobre as 4 RPCs publicas da Vitrine (migration 028,
// Fase 0). Cada uma resolve o tenant a partir do slug DENTRO da RPC -
// nunca aceitamos tenant_id vindo de fora. Erro de rede/RPC vira null
// (nao exception) - quem chama decide 404, nao existe fallback pra
// outro tenant.

export async function getPublicStoreSettings(tenantSlug: string): Promise<StoreSettingsPublico | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_store_settings', { p_tenant_slug: tenantSlug })
  if (error || !data || data.length === 0) return null
  return data[0]
}

export async function getPublicCategories(tenantSlug: string): Promise<CategoriaPublica[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_categories', { p_tenant_slug: tenantSlug })
  if (error || !data) return []
  return data
}

export async function getPublicProducts(tenantSlug: string): Promise<ProdutoPublico[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_products', { p_tenant_slug: tenantSlug })
  if (error || !data) return []
  return data
}

export async function getPublicProductDetail(tenantSlug: string, produtoSlug: string): Promise<ProdutoDetalhe | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_product_detail', {
    p_tenant_slug: tenantSlug,
    p_slug: produtoSlug,
  })
  if (error || !data) return null
  return data as unknown as ProdutoDetalhe
}

// Bucket product-images e publico pra leitura (migration 023) - a URL
// e so' concatenacao, sem chamada de rede/assinatura.
export function urlImagemProduto(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`
}
