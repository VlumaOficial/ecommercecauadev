import { notFound } from 'next/navigation'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicCategories, getPublicProducts } from '@/lib/loja/rpc'
import { BannerHero } from '@/components/loja/banner-hero'
import { SelosConfianca } from '@/components/loja/selos-confianca'
import { GridCategorias } from '@/components/loja/grid-categorias'
import { ProductGrid } from '@/components/loja/product-grid'

export default async function HomePage() {
  const tenant = await getTenantFromHeaders()
  if (!tenant) notFound()

  const [categorias, produtos] = await Promise.all([
    getPublicCategories(tenant.slug),
    getPublicProducts(tenant.slug),
  ])

  const destaques = produtos.filter((p) => p.destaque)

  return (
    <>
      <BannerHero />
      <SelosConfianca />
      <GridCategorias categorias={categorias} />
      {destaques.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <h2 className="mb-4 font-display text-xl font-bold text-foreground">Destaques</h2>
          <ProductGrid produtos={destaques} />
        </section>
      )}
    </>
  )
}
