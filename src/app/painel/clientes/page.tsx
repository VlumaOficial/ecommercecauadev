import { Suspense } from 'react'
import { ClientesView } from '@/components/painel/clientes/clientes-view'

export default function ClientesPage() {
  return (
    <Suspense fallback={null}>
      <ClientesView />
    </Suspense>
  )
}
