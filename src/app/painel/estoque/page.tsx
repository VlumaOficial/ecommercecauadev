import { Suspense } from 'react'
import { EstoqueView } from '@/components/painel/estoque/estoque-view'

export default function EstoquePage() {
  return (
    <Suspense fallback={null}>
      <EstoqueView />
    </Suspense>
  )
}
