import { Suspense } from 'react'
import { ProdutosView } from '@/components/painel/produtos/produtos-view'

export default function ProdutosPage() {
  return (
    <Suspense fallback={null}>
      <ProdutosView />
    </Suspense>
  )
}
