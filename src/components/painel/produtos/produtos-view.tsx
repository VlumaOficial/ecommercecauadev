'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { useQueryParamState } from '@/hooks/use-query-param-state'
import { StatusFilterTabs, type StatusFiltro } from '@/components/painel/crud/status-filter-tabs'
import { SearchInput } from '@/components/painel/crud/search-input'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { useCategorias } from '@/hooks/use-categorias'
import { getPath } from '@/lib/category-tree'
import { ProdutosTable } from './produtos-table'
import { useProdutos, useSetProdutoAtivo, type Produto } from '@/hooks/use-produtos'

type CategoriaOption = { value: string; label: string }

export function ProdutosView() {
  const [status, setStatus] = useQueryParamState('status', 'ativos')
  const [busca, setBusca] = useQueryParamState('busca', '')
  const [categoryId, setCategoryId] = useQueryParamState('categoria', '')

  const { data: produtos = [], isLoading } = useProdutos({
    status: status as StatusFiltro,
    busca,
    categoryId,
  })
  const { data: categorias = [] } = useCategorias()

  const [produtoParaInativar, setProdutoParaInativar] = useState<Produto | null>(null)
  const setAtivo = useSetProdutoAtivo()

  const opcoesCategoria = useMemo<CategoriaOption[]>(() => {
    return categorias
      .filter((c) => c.ativo)
      .map((c) => ({ value: c.id, label: getPath(c.id, categorias) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [categorias])

  const categoriaSelecionada = opcoesCategoria.find((o) => o.value === categoryId) ?? null

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
        <Button render={<Link href="/painel/produtos/novo" />}>
          <PlusIcon />
          Adicionar produto
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <StatusFilterTabs value={status as StatusFiltro} onChange={setStatus} />
        <div className="flex flex-wrap items-center gap-2">
          <Combobox
            items={opcoesCategoria}
            value={categoriaSelecionada}
            onValueChange={(item: CategoriaOption | null) => setCategoryId(item ? item.value : '')}
          >
            <ComboboxInputGroup className="w-full sm:w-56">
              <ComboboxInput placeholder="Filtrar por categoria" />
              <ComboboxClear />
              <ComboboxTrigger />
            </ComboboxInputGroup>
            <ComboboxContent>
              {(item: CategoriaOption) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxContent>
          </Combobox>
          <SearchInput
            defaultValue={busca}
            onChange={setBusca}
            placeholder="Buscar por nome ou código..."
            className="w-full sm:w-64"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-2">
        <ProdutosTable
          produtos={produtos}
          isLoading={isLoading}
          onInativar={setProdutoParaInativar}
          onReativar={(produto) => setAtivo.mutate({ id: produto.id!, ativo: true })}
        />
      </div>

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
