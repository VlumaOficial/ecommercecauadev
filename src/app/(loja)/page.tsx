import { notFound } from 'next/navigation'
import Link from 'next/link'

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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-foreground">Destaques do criatório</h2>
            <Link href="/produtos" className="text-sm font-semibold text-primary hover:underline">
              Ver mais →
            </Link>
          </div>
          <ProductGrid produtos={destaques} categorias={categorias} />
        </section>
      )}
    </>
  )
}
