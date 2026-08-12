import { notFound } from 'next/navigation'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicCategories, getPublicProducts } from '@/lib/loja/rpc'
import { ListagemPage } from '@/components/loja/listagem/listagem-page'

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ disponivel?: string; promocao?: string; ordenar?: string; q?: string }>
}) {
  const tenant = await getTenantFromHeaders()
  if (!tenant) notFound()

  const sp = await searchParams

  const [categorias, produtos] = await Promise.all([getPublicCategories(tenant.slug), getPublicProducts(tenant.slug)])

  return (
    <ListagemPage
      categorias={categorias}
      produtos={produtos}
      categoriaAtual={null}
      termoBusca={sp.q ?? ''}
      searchParams={sp}
    />
  )
}
