'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, UploadIcon, DownloadIcon, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useQueryParamState } from '@/hooks/use-query-param-state'
import { StatusFilterTabs, type StatusFiltro } from '@/components/painel/crud/status-filter-tabs'
import { SearchInput } from '@/components/painel/crud/search-input'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { useCategorias } from '@/hooks/use-categorias'
import { COLUNAS_PRODUTOS } from '@/lib/importacao/colunas-produtos'
import { baixarCsv, baixarXlsx } from '@/lib/importacao/download'
import { CategoriaFilterPopover } from './categoria-filter-popover'
import { ProdutosTable } from './produtos-table'
import { ProdutoViewDialog } from './produto-view-dialog'
import { ImportarProdutosDialog } from './importar-produtos-dialog'
import { ImportarFotosDialog } from './importar-fotos-dialog'
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
  const [importarAberto, setImportarAberto] = useState(false)
  const [importarFotosAberto, setImportarFotosAberto] = useState(false)
  const setAtivo = useSetProdutoAtivo()

  function confirmarInativar() {
    if (!produtoParaInativar) return
    setAtivo.mutate(
      { id: produtoParaInativar.id!, ativo: false },
      { onSuccess: () => setProdutoParaInativar(null) }
    )
  }

  // Frente A, incremento 2 (aprovado pelo PO em 04/09/2026) - exporta
  // respeitando os MESMOS filtros da URL (status/busca/categoria), no
  // formato de 15 colunas do Inc 1 (round-trip de formato). A leitura
  // (join produto+variação, resolução de nomes) é toda no servidor;
  // aqui só monta o arquivo a partir do JSON já achatado.
  async function exportar(formato: 'csv' | 'xlsx') {
    const params = new URLSearchParams({ status, busca })
    if (categoryId) params.set('category_id', categoryId)

    const response = await fetch(`/api/painel/produtos/exportar?${params.toString()}`)
    const body = await response.json().catch(() => null)
    if (!response.ok || !Array.isArray(body?.linhas)) {
      toast.error('Não foi possível exportar os produtos. Tente novamente.')
      return
    }

    const linhas: string[][] = body.linhas.map((l: Record<string, string>) =>
      COLUNAS_PRODUTOS.map((coluna) => l[coluna] ?? '')
    )
    const nomeBase = `produtos-${new Date().toISOString().slice(0, 10)}`
    if (linhas.length === 0) {
      toast.info('Nenhum produto encontrado com os filtros atuais.')
      return
    }
    if (formato === 'csv') baixarCsv([[...COLUNAS_PRODUTOS], ...linhas], `${nomeBase}.csv`)
    else baixarXlsx([[...COLUNAS_PRODUTOS], ...linhas], `${nomeBase}.xlsx`, 'Produtos')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Produtos</h1>
          <p className="text-muted-foreground mt-1">Gerencie o catálogo de produtos da loja.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <DownloadIcon />
              Exportar
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportar('csv')}>Exportar como CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportar('xlsx')}>Exportar como XLSX</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setImportarFotosAberto(true)}>
            <ImageIcon />
            Importar fotos
          </Button>
          <Button variant="outline" onClick={() => setImportarAberto(true)}>
            <UploadIcon />
            Importar produtos
          </Button>
          <Button render={<Link href="/painel/produtos/novo" />} nativeButton={false}>
            <PlusIcon />
            Adicionar produto
          </Button>
        </div>
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

      <ImportarProdutosDialog open={importarAberto} onOpenChange={setImportarAberto} categorias={categorias} />
      <ImportarFotosDialog open={importarFotosAberto} onOpenChange={setImportarFotosAberto} />
    </div>
  )
}
