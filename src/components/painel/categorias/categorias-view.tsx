'use client'

import { useMemo, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQueryParamState } from '@/hooks/use-query-param-state'
import { StatusFilterTabs, type StatusFiltro } from '@/components/painel/crud/status-filter-tabs'
import { SearchInput } from '@/components/painel/crud/search-input'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { CategoriasTree } from './categorias-tree'
import { CategoriaFormDialog } from './categoria-form-dialog'
import { buildTree, computeVisibleIds, type CategoriaTreeNode } from '@/lib/category-tree'
import {
  useCategorias,
  useCreateCategoria,
  useUpdateCategoria,
  useSetCategoriaAtivo,
  type Categoria,
  type CategoriaFormValues,
} from '@/hooks/use-categorias'

export function CategoriasView() {
  const [status, setStatus] = useQueryParamState('status', 'ativos')
  const [busca, setBusca] = useQueryParamState('busca', '')

  const { data: categorias = [], isLoading } = useCategorias()

  const arvore = useMemo(() => buildTree(categorias), [categorias])
  const visibleIds = useMemo(
    () => computeVisibleIds(categorias, { status: status as StatusFiltro, busca }),
    [categorias, status, busca]
  )
  const autoExpand = busca.trim().length > 0

  const [formAberto, setFormAberto] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(null)
  const [categoriaParaInativar, setCategoriaParaInativar] = useState<CategoriaTreeNode | null>(null)

  const criar = useCreateCategoria()
  const atualizar = useUpdateCategoria()
  const setAtivo = useSetCategoriaAtivo()

  function abrirNovo() {
    setCategoriaEditando(null)
    setFormAberto(true)
  }

  function abrirEdicao(categoria: Categoria) {
    setCategoriaEditando(categoria)
    setFormAberto(true)
  }

  function handleSubmit(values: CategoriaFormValues) {
    if (categoriaEditando) {
      atualizar.mutate(
        { id: categoriaEditando.id, values },
        { onSuccess: () => setFormAberto(false) }
      )
    } else {
      criar.mutate(values, { onSuccess: () => setFormAberto(false) })
    }
  }

  function confirmarInativar() {
    if (!categoriaParaInativar) return
    setAtivo.mutate(
      { id: categoriaParaInativar.id, ativo: false },
      { onSuccess: () => setCategoriaParaInativar(null) }
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Categorias</h1>
          <p className="text-muted-foreground mt-1">Organize o catalogo em arvore, com quantos niveis precisar.</p>
        </div>
        <Button onClick={abrirNovo}>
          <PlusIcon />
          Nova categoria
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <StatusFilterTabs value={status as StatusFiltro} onChange={setStatus} />
        <SearchInput
          defaultValue={busca}
          onChange={setBusca}
          placeholder="Buscar por nome..."
          className="w-full sm:w-64"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card px-2 py-1">
        <CategoriasTree
          arvore={arvore}
          visibleIds={visibleIds}
          autoExpand={autoExpand}
          isLoading={isLoading}
          onEdit={abrirEdicao}
          onInativar={setCategoriaParaInativar}
          onReativar={(node) => setAtivo.mutate({ id: node.id, ativo: true })}
        />
      </div>

      <CategoriaFormDialog
        open={formAberto}
        onOpenChange={setFormAberto}
        categoria={categoriaEditando}
        todasCategorias={categorias}
        onSubmit={handleSubmit}
        loading={criar.isPending || atualizar.isPending}
      />

      <ConfirmDialog
        open={!!categoriaParaInativar}
        onOpenChange={(open) => !open && setCategoriaParaInativar(null)}
        title="Inativar categoria?"
        description={
          categoriaParaInativar && categoriaParaInativar.filhos.length > 0
            ? `"${categoriaParaInativar.nome}" tem ${categoriaParaInativar.filhos.length} subcategoria(s). Inativa-la nao afeta o status delas — se quiser oculta-las tambem, inative cada uma separadamente.`
            : `"${categoriaParaInativar?.nome}" deixara de aparecer para novos produtos ate ser reativada.`
        }
        confirmLabel="Inativar"
        destructive
        loading={setAtivo.isPending}
        onConfirm={confirmarInativar}
      />
    </div>
  )
}
