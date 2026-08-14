import { Suspense } from 'react'
import { VitrineConfigView } from '@/components/painel/vitrine/vitrine-config-view'

export default function VitrinePage() {
  return (
    <Suspense fallback={null}>
      <VitrineConfigView />
    </Suspense>
  )
}
