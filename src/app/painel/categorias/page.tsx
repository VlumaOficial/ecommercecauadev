import { Suspense } from 'react'
import { CategoriasView } from '@/components/painel/categorias/categorias-view'

export default function CategoriasPage() {
  return (
    <Suspense fallback={null}>
      <CategoriasView />
    </Suspense>
  )
}
