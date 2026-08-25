import { Suspense } from 'react'
import { ConfiguracoesView } from '@/components/painel/configuracoes/configuracoes-view'

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={null}>
      <ConfiguracoesView />
    </Suspense>
  )
}
