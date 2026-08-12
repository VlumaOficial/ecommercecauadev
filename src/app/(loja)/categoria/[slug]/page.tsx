import { notFound } from 'next/navigation'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicCategories, getPublicProducts } from '@/lib/loja/rpc'
import { ListagemPage } from '@/components/loja/listagem/listagem-page'

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ disponivel?: string; promocao?: string; ordenar?: string; q?: string }>
}) {
  const tenant = await getTenantFromHeaders()
  if (!tenant) notFound()

  const { slug } = await params
  const sp = await searchParams

  const [categorias, produtos] = await Promise.all([getPublicCategories(tenant.slug), getPublicProducts(tenant.slug)])

  const categoriaAtual = categorias.find((c) => c.slug === slug)
  if (!categoriaAtual) notFound()

  return (
    <ListagemPage
      categorias={categorias}
      produtos={produtos}
      categoriaAtual={categoriaAtual}
      termoBusca={sp.q ?? ''}
      searchParams={sp}
    />
  )
}
