import { Suspense } from 'react'
import { EquipeView } from '@/components/painel/equipe/equipe-view'

export default function EquipePage() {
  return (
    <Suspense fallback={null}>
      <EquipeView />
    </Suspense>
  )
}
