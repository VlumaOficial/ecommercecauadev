'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQueryParamState } from '@/hooks/use-query-param-state'
import { StatusFilterTabs, type StatusFiltro } from '@/components/painel/crud/status-filter-tabs'
import { SearchInput } from '@/components/painel/crud/search-input'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { useCategorias } from '@/hooks/use-categorias'
import { CategoriaFilterPopover } from './categoria-filter-popover'
import { ProdutosTable } from './produtos-table'
import { ProdutoViewDialog } from './produto-view-dialog'
import {
  useProdutos,
  useSetProdutoAtivo,
  useContagemProdutosPorCategoria,
  type Produto,
} from '@/hooks/use-produtos'

export function ProdutosView() {
  const router = useRouter()
  const [status, setStatus] = useQueryParamState('status', 'ativos')
  const [busca, setBusca] = useQueryParamState('busca', '')
  const [categoryId, setCategoryId] = useQueryParamState('categoria', '')

  const { data: produtos = [], isLoading } = useProdutos({
    status: status as StatusFiltro,
    busca,
    categoryId,
  })
  const { data: categorias = [] } = useCategorias()
  const { data: contagemPorCategoria = {} } = useContagemProdutosPorCategoria(status as StatusFiltro)

  const [produtoParaInativar, setProdutoParaInativar] = useState<Produto | null>(null)
  const [produtoVisualizando, setProdutoVisualizando] = useState<Produto | null>(null)
  const setAtivo = useSetProdutoAtivo()

  function confirmarInativar() {
    if (!produtoParaInativar) return
    setAtivo.mutate(
      { id: produtoParaInativar.id!, ativo: false },
      { onSuccess: () => setProdutoParaInativar(null) }
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Produtos</h1>
          <p className="text-muted-foreground mt-1">Gerencie o catálogo de produtos da loja.</p>
        </div>
        <Button render={<Link href="/painel/produtos/novo" />} nativeButton={false}>
          <PlusIcon />
          Adicionar produto
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <StatusFilterTabs value={status as StatusFiltro} onChange={setStatus} />
        <div className="flex flex-wrap items-center gap-2">
          <CategoriaFilterPopover
            categorias={categorias}
            contagem={contagemPorCategoria}
            value={categoryId}
            onChange={setCategoryId}
          />
          <SearchInput
            defaultValue={busca}
            onChange={setBusca}
            placeholder="Buscar por nome, código, SKU ou variação..."
            className="w-full sm:w-64"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-2">
        <ProdutosTable
          produtos={produtos}
          isLoading={isLoading}
          busca={busca}
          onRowClick={setProdutoVisualizando}
          onInativar={setProdutoParaInativar}
          onReativar={(produto) => setAtivo.mutate({ id: produto.id!, ativo: true })}
        />
      </div>

      <ProdutoViewDialog
        open={!!produtoVisualizando}
        onOpenChange={(open) => !open && setProdutoVisualizando(null)}
        produto={produtoVisualizando}
        onEdit={() => {
          if (produtoVisualizando) router.push(`/painel/produtos/${produtoVisualizando.id}`)
        }}
      />

      <ConfirmDialog
        open={!!produtoParaInativar}
        onOpenChange={(open) => !open && setProdutoParaInativar(null)}
        title="Inativar produto?"
        description={`"${produtoParaInativar?.nome}" deixará de aparecer na vitrine até ser reativado.`}
        confirmLabel="Inativar"
        destructive
        loading={setAtivo.isPending}
        onConfirm={confirmarInativar}
      />
    </div>
  )
}
