'use client'

import { useState } from 'react'
import { ChevronRightIcon, ChevronDownIcon, PencilIcon, PowerIcon, RotateCcwIcon, ListTreeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import type { CategoriaTreeNode } from '@/lib/category-tree'

function LinhaCategoria({
  node,
  nivel,
  visibleIds,
  autoExpand,
  expandedIds,
  toggleExpand,
  onEdit,
  onInativar,
  onReativar,
  onCaracteristicas,
}: {
  node: CategoriaTreeNode
  nivel: number
  visibleIds: Set<string>
  autoExpand: boolean
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
  onEdit: (node: CategoriaTreeNode) => void
  onInativar: (node: CategoriaTreeNode) => void
  onReativar: (node: CategoriaTreeNode) => void
  onCaracteristicas: (node: CategoriaTreeNode) => void
}) {
  if (!visibleIds.has(node.id)) return null

  const filhosVisiveis = node.filhos.filter((f) => visibleIds.has(f.id))
  const temFilhos = filhosVisiveis.length > 0
  const aberto = autoExpand || expandedIds.has(node.id)

  return (
    <>
      <div
        className="flex items-center gap-1.5 rounded-lg py-2 pr-2 hover:bg-muted/50"
        style={{ paddingLeft: 8 + nivel * 24 }}
      >
        {temFilhos ? (
          <button
            type="button"
            onClick={() => toggleExpand(node.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label={aberto ? 'Recolher' : 'Expandir'}
          >
            {aberto ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        <span className="flex-1 truncate text-sm font-medium text-foreground">{node.nome}</span>
        <StatusBadge ativo={node.ativo} />

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onCaracteristicas(node)}
            title="Caracteristicas"
            aria-label="Caracteristicas"
          >
            <ListTreeIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(node)} aria-label="Editar categoria">
            <PencilIcon />
          </Button>
          {node.ativo ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onInativar(node)}
              aria-label="Inativar categoria"
            >
              <PowerIcon />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onReativar(node)}
              aria-label="Reativar categoria"
            >
              <RotateCcwIcon />
            </Button>
          )}
        </div>
      </div>

      {temFilhos && aberto && (
        <div>
          {filhosVisiveis.map((filho) => (
            <LinhaCategoria
              key={filho.id}
              node={filho}
              nivel={nivel + 1}
              visibleIds={visibleIds}
              autoExpand={autoExpand}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              onEdit={onEdit}
              onInativar={onInativar}
              onReativar={onReativar}
              onCaracteristicas={onCaracteristicas}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function CategoriasTree({
  arvore,
  visibleIds,
  autoExpand,
  isLoading,
  onEdit,
  onInativar,
  onReativar,
  onCaracteristicas,
}: {
  arvore: CategoriaTreeNode[]
  visibleIds: Set<string>
  autoExpand: boolean
  isLoading: boolean
  onEdit: (node: CategoriaTreeNode) => void
  onInativar: (node: CategoriaTreeNode) => void
  onReativar: (node: CategoriaTreeNode) => void
  onCaracteristicas: (node: CategoriaTreeNode) => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  const raizesVisiveis = arvore.filter((n) => visibleIds.has(n.id))

  if (raizesVisiveis.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhuma categoria encontrada.
      </p>
    )
  }

  return (
    <div className="py-1">
      {raizesVisiveis.map((raiz) => (
        <LinhaCategoria
          key={raiz.id}
          node={raiz}
          nivel={0}
          visibleIds={visibleIds}
          autoExpand={autoExpand}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEdit={onEdit}
          onInativar={onInativar}
          onReativar={onReativar}
          onCaracteristicas={onCaracteristicas}
        />
      ))}
    </div>
  )
}
