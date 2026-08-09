'use client'

import { useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, FolderTreeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  buildTree,
  computeVisibleIds,
  getPath,
  type CategoriaNode,
  type CategoriaTreeNode,
} from '@/lib/category-tree'

function NoArvore({
  node,
  depth,
  expandedIds,
  toggleExpand,
  visibleIds,
  autoExpand,
  value,
  onSelect,
  contagem,
}: {
  node: CategoriaTreeNode
  depth: number
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
  visibleIds: Set<string>
  autoExpand: boolean
  value: string
  onSelect: (id: string) => void
  contagem: Record<string, number>
}) {
  if (!visibleIds.has(node.id)) return null

  const temFilhos = node.filhos.length > 0
  const aberto = autoExpand || expandedIds.has(node.id)
  const selecionado = value === node.id

  return (
    <div>
      <div
        role="option"
        aria-selected={selecionado}
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelect(node.id)
        }}
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
          selecionado && 'bg-primary/10 font-medium text-primary hover:bg-primary/10'
        )}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {temFilhos ? (
          <button
            type="button"
            aria-label={aberto ? 'Recolher' : 'Expandir'}
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(node.id)
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            {aberto ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
          </button>
        ) : (
          <span className="inline-block size-3.5 shrink-0" />
        )}
        <span className="flex-1 truncate">{node.nome}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{contagem[node.id] ?? 0}</span>
      </div>
      {temFilhos && aberto && (
        <div>
          {node.filhos.map((filho) => (
            <NoArvore
              key={filho.id}
              node={filho}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              visibleIds={visibleIds}
              autoExpand={autoExpand}
              value={value}
              onSelect={onSelect}
              contagem={contagem}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Filtro de categoria em árvore navegável pra listagem de produtos —
// substitui o Combobox de lista achatada (que ficava impraticável com
// dezenas de categorias em vários níveis, cada opção mostrando o
// caminho inteiro tipo "Peixes > Ciclídeos > Nanicos"). Reaproveita
// buildTree/computeVisibleIds/getPath de lib/category-tree.ts (a
// mesma base usada em /painel/categorias), mas é um componente novo —
// CategoriasTree de categorias-tree.tsx é acoplado a 5 ações de CRUD
// por linha, sem modo de seleção simples.
export function CategoriaTreeFilter({
  categorias,
  contagem,
  value,
  onChange,
}: {
  categorias: CategoriaNode[]
  contagem: Record<string, number>
  value: string
  onChange: (categoryId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Só categorias ativas entram no filtro (mesma regra do Combobox
  // anterior) — a cascata de inativação (§3.1) garante que uma
  // categoria ativa nunca tem ancestral inativo, então a árvore
  // montada só com as ativas preserva a hierarquia certa sem precisar
  // "pular" um pai inativo no meio do caminho.
  const categoriasAtivas = useMemo(() => categorias.filter((c) => c.ativo), [categorias])
  const arvore = useMemo(() => buildTree(categoriasAtivas), [categoriasAtivas])
  const visibleIds = useMemo(
    () => computeVisibleIds(categoriasAtivas, { status: 'ativos', busca }),
    [categoriasAtivas, busca]
  )
  const autoExpand = busca.trim().length > 0
  const totalGeral = useMemo(() => Object.values(contagem).reduce((soma, n) => soma + n, 0), [contagem])
  const categoriaSelecionada = categoriasAtivas.find((c) => c.id === value)

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setBusca('')
      }}
    >
      <PopoverTrigger
        render={<Button variant="outline" className="w-full justify-between font-normal sm:w-64" />}
        nativeButton={false}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <FolderTreeIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {categoriaSelecionada ? getPath(categoriaSelecionada.id, categoriasAtivas) : 'Todas as categorias'}
          </span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b border-border p-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar categorias..."
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          <div
            role="option"
            aria-selected={!value}
            tabIndex={0}
            onClick={() => handleSelect('')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSelect('')
            }}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
              !value && 'bg-primary/10 font-medium text-primary hover:bg-primary/10'
            )}
          >
            <span>Todas as categorias</span>
            <span className="text-xs tabular-nums text-muted-foreground">{totalGeral}</span>
          </div>
          {arvore.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhuma categoria ativa.</p>
          )}
          {arvore.map((node) => (
            <NoArvore
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              visibleIds={visibleIds}
              autoExpand={autoExpand}
              value={value}
              onSelect={handleSelect}
              contagem={contagem}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
