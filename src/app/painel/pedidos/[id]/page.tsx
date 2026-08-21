'use client'

import { useParams } from 'next/navigation'
import { PedidoDetalheView } from '@/components/painel/pedidos/pedido-detalhe-view'

export default function PedidoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  return <PedidoDetalheView id={id} />
}
