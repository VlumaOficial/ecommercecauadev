'use client'

import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon, PencilIcon, PowerIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import type { Caracteristica } from '@/hooks/use-caracteristicas'

const ROTULOS_TIPO: Record<string, string> = {
  texto: 'Texto',
  numero: 'Numero',
  selecao: 'Selecao',
  booleano: 'Sim/Nao',
  data: 'Data',
}

function LinhaCaracteristica({
  item,
  onEdit,
  onInativar,
  onReativar,
}: {
  item: Caracteristica
  onEdit: (c: Caracteristica) => void
  onInativar: (c: Caracteristica) => void
  onReativar: (c: Caracteristica) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.rotulo}</span>
          <StatusBadge ativo={item.ativo} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{ROTULOS_TIPO[item.tipo] ?? item.tipo}</span>
          {item.obrigatorio && <span>&middot; Obrigatoria</span>}
          {item.usar_em_filtro && <span>&middot; Usada como filtro</span>}
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(item)} aria-label="Editar caracteristica">
          <PencilIcon />
        </Button>
        {item.ativo ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onInativar(item)}
            aria-label="Inativar caracteristica"
          >
            <PowerIcon />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onReativar(item)}
            aria-label="Reativar caracteristica"
          >
            <RotateCcwIcon />
          </Button>
        )}
      </div>
    </div>
  )
}

export function CaracteristicasList({
  caracteristicas,
  isLoading,
  onReorder,
  onEdit,
  onInativar,
  onReativar,
}: {
  caracteristicas: Caracteristica[]
  isLoading: boolean
  onReorder: (ids: string[]) => void
  onEdit: (c: Caracteristica) => void
  onInativar: (c: Caracteristica) => void
  onReativar: (c: Caracteristica) => void
}) {
  // Estado local pra reordenar otimisticamente durante o drag (nao
  // esperar o round-trip do servidor) — sincronizado sempre que a
  // query trouxer dados novos (criacao, edicao, ou correcao apos
  // erro de reorder).
  const [itens, setItens] = useState(caracteristicas)
  useEffect(() => setItens(caracteristicas), [caracteristicas])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = itens.findIndex((i) => i.id === active.id)
    const newIndex = itens.findIndex((i) => i.id === over.id)
    const proxima = arrayMove(itens, oldIndex, newIndex)
    setItens(proxima)
    onReorder(proxima.map((i) => i.id))
  }

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (itens.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma caracteristica cadastrada.</p>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itens.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {itens.map((item) => (
            <LinhaCaracteristica
              key={item.id}
              item={item}
              onEdit={onEdit}
              onInativar={onInativar}
              onReativar={onReativar}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
