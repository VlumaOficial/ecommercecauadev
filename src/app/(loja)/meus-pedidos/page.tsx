import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCustomerProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatarMoeda } from '@/lib/utils'
import { NavConta } from '@/components/loja/pedidos/nav-conta'
import { PedidoStatusBadge } from '@/components/loja/pedidos/status-badge'

export const dynamic = 'force-dynamic'

// Fase 2, incremento 6 (Área do Cliente) - leitura direta via client
// SERVIDOR + RLS (orders_select_own, migration 037), sem Route Handler:
// é GET de conteúdo de página, mesmo padrão já usado por
// getCustomerProfile()/getPublicDeliveryCities() no /checkout.
export default async function MeusPedidosPage() {
  const cliente = await getCustomerProfile()
  if (!cliente) redirect('/entrar?proximo=/meus-pedidos')

  const supabase = await createClient()
  const { data: pedidos } = await supabase
    .from('orders')
    .select('numero, status, total, created_at, delivery_cities(nome, uf)')
    .eq('customer_id', cliente.id)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <NavConta />
      <h1 className="font-display text-xl font-bold text-primary mb-6">Meus Pedidos</h1>

      {!pedidos || pedidos.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)]">
          <p className="mb-4 text-sm text-muted-foreground">Você ainda não fez nenhum pedido.</p>
          <Link href="/produtos" className="text-sm font-semibold text-primary hover:underline">
            Ver produtos →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((p) => (
            <li key={p.numero}>
              <Link
                href={`/meus-pedidos/${p.numero}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] transition-colors hover:border-primary/40 sm:p-5"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">Pedido #{p.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    {p.delivery_cities ? ` · ${p.delivery_cities.nome}${p.delivery_cities.uf ? ' - ' + p.delivery_cities.uf : ''}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <PedidoStatusBadge status={p.status} />
                  <span className="text-sm font-semibold text-foreground">{formatarMoeda(p.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
