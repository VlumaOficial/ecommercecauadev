import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { getCustomerProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatarMoeda } from '@/lib/utils'
import { PedidoStatusBadge } from '@/components/loja/pedidos/status-badge'

export const dynamic = 'force-dynamic'

// Fase 2, incremento 6 (Área do Cliente). IMPORTANTE: a query abaixo NUNCA
// seleciona `observacao_interna` - não é "escondida na tela", é uma coluna
// que este SELECT nem pede ao banco (é anotação do vendedor, o cliente
// nunca deve ver, REGRAS_DE_NEGOCIO.md §19.3/migration 037). `numero` só é
// único POR TENANT, não globalmente - o filtro por `customer_id` (defesa
// em profundidade, além da RLS orders_select_own) garante que só aparece
// se for realmente do cliente logado; qualquer outro caso vira 404, sem
// revelar se o número existe pra outro cliente.
export default async function MeuPedidoDetalhePage({ params }: { params: Promise<{ numero: string }> }) {
  const cliente = await getCustomerProfile()
  const { numero } = await params
  const numeroInt = Number(numero)
  if (!cliente) redirect(`/entrar?proximo=/meus-pedidos/${numero}`)
  if (!Number.isInteger(numeroInt)) notFound()

  const supabase = await createClient()
  const { data: pedido } = await supabase
    .from('orders')
    .select(
      'id, numero, status, modalidade_entrega, data_prevista, data_efetiva, observacao_cliente, total, created_at, delivery_cities(nome, uf, ponto_entrega, horario)'
    )
    .eq('customer_id', cliente.id)
    .eq('numero', numeroInt)
    .maybeSingle()

  if (!pedido) notFound()

  const { data: itens } = await supabase
    .from('order_items')
    .select('quantidade, preco_unitario, subtotal, products(nome), product_variants(nome)')
    .eq('order_id', pedido.id)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/meus-pedidos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Meus Pedidos
      </Link>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-primary">Pedido #{pedido.numero}</h1>
            <p className="text-xs text-muted-foreground">{new Date(pedido.created_at).toLocaleString('pt-BR')}</p>
          </div>
          <PedidoStatusBadge status={pedido.status} />
        </div>

        <ul className="mb-4 flex flex-col gap-3 border-t border-border pt-4">
          {(itens ?? []).map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium text-foreground">{item.products?.nome}</p>
                {item.product_variants?.nome && item.product_variants.nome !== 'Padrão' && (
                  <p className="text-xs text-muted-foreground">{item.product_variants.nome}</p>
                )}
                <p className="text-xs text-muted-foreground">Qtd: {item.quantidade} · {formatarMoeda(item.preco_unitario)} cada</p>
              </div>
              <span className="font-semibold text-foreground">{formatarMoeda(item.subtotal)}</span>
            </li>
          ))}
        </ul>

        {pedido.delivery_cities && (
          <div className="mb-4 space-y-1 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Entrega em:</span> {pedido.delivery_cities.nome}
              {pedido.delivery_cities.uf ? ` - ${pedido.delivery_cities.uf}` : ''}
            </p>
            {pedido.delivery_cities.ponto_entrega && (
              <p>
                <span className="font-medium text-foreground">Ponto de encontro:</span> {pedido.delivery_cities.ponto_entrega}
              </p>
            )}
            {pedido.delivery_cities.horario && (
              <p>
                <span className="font-medium text-foreground">Horário:</span> {pedido.delivery_cities.horario}
              </p>
            )}
          </div>
        )}

        {(pedido.data_prevista || pedido.data_efetiva) && (
          <div className="mb-4 space-y-1 text-sm text-muted-foreground">
            {pedido.data_prevista && (
              <p>
                <span className="font-medium text-foreground">Data prevista:</span>{' '}
                {new Date(pedido.data_prevista).toLocaleDateString('pt-BR')}
              </p>
            )}
            {pedido.data_efetiva && (
              <p>
                <span className="font-medium text-foreground">Data efetiva:</span>{' '}
                {new Date(pedido.data_efetiva).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {pedido.observacao_cliente && (
          <div className="mb-4 rounded-lg bg-muted/50 p-4 text-sm">
            <p className="mb-1 font-medium text-foreground">Sua observação</p>
            <p className="text-muted-foreground">{pedido.observacao_cliente}</p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <span className="font-display text-lg font-extrabold text-foreground">{formatarMoeda(pedido.total)}</span>
        </div>
      </div>
    </div>
  )
}
