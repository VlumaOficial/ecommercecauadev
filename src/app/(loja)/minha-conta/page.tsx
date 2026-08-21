import { redirect } from 'next/navigation'

import { getCustomerProfile } from '@/lib/auth'
import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicDeliveryCities } from '@/lib/loja/rpc'
import { NavConta } from '@/components/loja/pedidos/nav-conta'
import { ContaForm } from '@/components/loja/conta/conta-form'

export const dynamic = 'force-dynamic'

export default async function MinhaContaPage() {
  const cliente = await getCustomerProfile()
  if (!cliente) redirect('/entrar?proximo=/minha-conta')

  const tenant = await getTenantFromHeaders()
  const cidades = tenant ? await getPublicDeliveryCities(tenant.slug) : []

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <NavConta />
      <h1 className="font-display text-xl font-bold text-primary mb-6">Minha Conta</h1>
      <ContaForm cliente={cliente} cidades={cidades} />
    </div>
  )
}
