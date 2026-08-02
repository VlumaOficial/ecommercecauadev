import { Suspense } from 'react'
import { UnidadesVendaView } from '@/components/painel/unidades-venda/unidades-venda-view'

export default function UnidadesVendaPage() {
  return (
    <Suspense fallback={null}>
      <UnidadesVendaView />
    </Suspense>
  )
}
