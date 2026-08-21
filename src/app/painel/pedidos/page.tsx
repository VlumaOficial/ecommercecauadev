import { Suspense } from 'react'
import { PedidosView } from '@/components/painel/pedidos/pedidos-view'

export default function PedidosPage() {
  return (
    <Suspense fallback={null}>
      <PedidosView />
    </Suspense>
  )
}
