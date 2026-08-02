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
import { CategoriaViewDialog } from './categoria-view-dialog'
import { CaracteristicasSheet } from './caracteristicas-sheet'
import { buildTree, computeVisibleIds, getDescendantIds, type CategoriaTreeNode } from '@/lib/category-tree'
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
  const [categoriaParaReativar, setCategoriaParaReativar] = useState<CategoriaTreeNode | null>(null)
  const [categoriaCaracteristicas, setCategoriaCaracteristicas] = useState<CategoriaTreeNode | null>(null)
  const [categoriaVisualizando, setCategoriaVisualizando] = useState<CategoriaTreeNode | null>(null)

  const criar = useCreateCategoria()
  const atualizar = useUpdateCategoria()
  const setAtivo = useSetCategoriaAtivo()

  // Contagem recursiva (subarvore inteira, nao so filhos diretos) pros
  // avisos de cascata — ver REGRAS_DE_NEGOCIO.md §3.1.
  const descendentesAtivosParaInativar = useMemo(() => {
    if (!categoriaParaInativar) return 0
    const descendentes = getDescendantIds(categoriaParaInativar.id, categorias)
    return categorias.filter((c) => descendentes.has(c.id) && c.ativo).length
  }, [categoriaParaInativar, categorias])

  const descendentesCascateadosParaReativar = useMemo(() => {
    if (!categoriaParaReativar) return 0
    const descendentes = getDescendantIds(categoriaParaReativar.id, categorias)
    return categorias.filter((c) => descendentes.has(c.id) && c.inativado_em_cascata).length
  }, [categoriaParaReativar, categorias])

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

  function handleReativarClick(node: CategoriaTreeNode) {
    const descendentes = getDescendantIds(node.id, categorias)
    const temCascata = categorias.some((c) => descendentes.has(c.id) && c.inativado_em_cascata)
    if (temCascata) {
      setCategoriaParaReativar(node)
    } else {
      setAtivo.mutate({ id: node.id, ativo: true })
    }
  }

  function confirmarReativar() {
    if (!categoriaParaReativar) return
    setAtivo.mutate(
      { id: categoriaParaReativar.id, ativo: true },
      { onSuccess: () => setCategoriaParaReativar(null) }
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
          onView={setCategoriaVisualizando}
          onEdit={abrirEdicao}
          onInativar={setCategoriaParaInativar}
          onReativar={handleReativarClick}
          onCaracteristicas={setCategoriaCaracteristicas}
        />
      </div>

      <CategoriaViewDialog
        open={!!categoriaVisualizando}
        onOpenChange={(open) => !open && setCategoriaVisualizando(null)}
        categoria={categoriaVisualizando}
        todasCategorias={categorias}
        onEdit={() => {
          if (categoriaVisualizando) {
            setCategoriaVisualizando(null)
            abrirEdicao(categoriaVisualizando)
          }
        }}
      />

      <CaracteristicasSheet
        categoria={categoriaCaracteristicas}
        open={!!categoriaCaracteristicas}
        onOpenChange={(open) => !open && setCategoriaCaracteristicas(null)}
      />

      <CategoriaFormDialog
        key={categoriaEditando?.id ?? 'novo'}
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
          descendentesAtivosParaInativar > 0
            ? `Ao inativar "${categoriaParaInativar?.nome}", as ${descendentesAtivosParaInativar} subcategoria(s) ativa(s) abaixo tambem serao inativadas.`
            : `"${categoriaParaInativar?.nome}" deixara de aparecer para novos produtos ate ser reativada.`
        }
        confirmLabel="Inativar"
        destructive
        loading={setAtivo.isPending}
        onConfirm={confirmarInativar}
      />

      <ConfirmDialog
        open={!!categoriaParaReativar}
        onOpenChange={(open) => !open && setCategoriaParaReativar(null)}
        title="Reativar categoria?"
        description={`Ao reativar "${categoriaParaReativar?.nome}", as ${descendentesCascateadosParaReativar} subcategoria(s) inativada(s) junto com ela voltarao.`}
        confirmLabel="Reativar"
        loading={setAtivo.isPending}
        onConfirm={confirmarReativar}
      />
    </div>
  )
}
