import { Suspense } from 'react'
import { CidadesView } from '@/components/painel/cidades/cidades-view'

export default function CidadesPage() {
  return (
    <Suspense fallback={null}>
      <CidadesView />
    </Suspense>
  )
}
