'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { CaracteristicasList } from './caracteristicas-list'
import { CaracteristicaFormDialog } from './caracteristica-form-dialog'
import {
  useCaracteristicas,
  useCreateCaracteristica,
  useUpdateCaracteristica,
  useSetCaracteristicaAtivo,
  useReordenarCaracteristicas,
  type Caracteristica,
  type CaracteristicaFormValues,
} from '@/hooks/use-caracteristicas'
import type { CategoriaTreeNode } from '@/lib/category-tree'

export function CaracteristicasSheet({
  categoria,
  open,
  onOpenChange,
}: {
  categoria: CategoriaTreeNode | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const categoryId = categoria?.id ?? ''
  const { data: caracteristicas = [], isLoading } = useCaracteristicas(open ? categoryId : null)

  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Caracteristica | null>(null)
  const [paraInativar, setParaInativar] = useState<Caracteristica | null>(null)

  const criar = useCreateCaracteristica(categoryId)
  const atualizar = useUpdateCaracteristica(categoryId)
  const setAtivo = useSetCaracteristicaAtivo(categoryId)
  const reordenar = useReordenarCaracteristicas(categoryId)

  function abrirNova() {
    setEditando(null)
    setFormAberto(true)
  }

  function abrirEdicao(caracteristica: Caracteristica) {
    setEditando(caracteristica)
    setFormAberto(true)
  }

  function handleSubmit(values: CaracteristicaFormValues) {
    if (editando) {
      atualizar.mutate({ id: editando.id, values }, { onSuccess: () => setFormAberto(false) })
    } else {
      criar.mutate(values, { onSuccess: () => setFormAberto(false) })
    }
  }

  function confirmarInativar() {
    if (!paraInativar) return
    setAtivo.mutate({ id: paraInativar.id, ativo: false }, { onSuccess: () => setParaInativar(null) })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Caracteristicas de {categoria?.nome}</SheetTitle>
            <SheetDescription>
              Ficha tecnica e filtros que os produtos desta categoria vao usar. Arraste para reordenar.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mb-3 flex justify-end">
              <Button size="sm" onClick={abrirNova}>
                <PlusIcon />
                Nova caracteristica
              </Button>
            </div>

            <CaracteristicasList
              caracteristicas={caracteristicas}
              isLoading={isLoading}
              onReorder={(ids) => reordenar.mutate(ids)}
              onEdit={abrirEdicao}
              onInativar={setParaInativar}
              onReativar={(c) => setAtivo.mutate({ id: c.id, ativo: true })}
            />
          </div>
        </SheetContent>
      </Sheet>

      <CaracteristicaFormDialog
        key={editando?.id ?? 'novo'}
        open={formAberto}
        onOpenChange={setFormAberto}
        caracteristica={editando}
        onSubmit={handleSubmit}
        loading={criar.isPending || atualizar.isPending}
      />

      <ConfirmDialog
        open={!!paraInativar}
        onOpenChange={(open) => !open && setParaInativar(null)}
        title="Inativar caracteristica?"
        description={`"${paraInativar?.rotulo}" deixara de aparecer no cadastro de produtos desta categoria ate ser reativada.`}
        confirmLabel="Inativar"
        destructive
        loading={setAtivo.isPending}
        onConfirm={confirmarInativar}
      />
    </>
  )
}
