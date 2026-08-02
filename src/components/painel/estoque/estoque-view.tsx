'use client'

import { useState } from 'react'
import { useQueryParamState } from '@/hooks/use-query-param-state'
import { SearchInput } from '@/components/painel/crud/search-input'
import { EstoqueStatusFilterTabs } from './estoque-status-filter-tabs'
import { EstoqueTable } from './estoque-table'
import { MovimentacaoFormDialog } from './movimentacao-form-dialog'
import { HistoricoDialog } from './historico-dialog'
import {
  useEstoque,
  useRegistrarMovimentacao,
  type EstoqueFiltro,
  type ItemEstoque,
  type MovimentacaoFormValues,
} from '@/hooks/use-estoque'

export function EstoqueView() {
  const [status, setStatus] = useQueryParamState('status', 'todos')
  const [busca, setBusca] = useQueryParamState('busca', '')

  const { data: itens = [], isLoading } = useEstoque({
    status: status as EstoqueFiltro,
    busca,
  })

  const [itemMovimentando, setItemMovimentando] = useState<ItemEstoque | null>(null)
  const [itemVisualizando, setItemVisualizando] = useState<ItemEstoque | null>(null)

  const registrar = useRegistrarMovimentacao()

  function handleSubmit(values: MovimentacaoFormValues) {
    registrar.mutate(values, { onSuccess: () => setItemMovimentando(null) })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Estoque</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe o saldo por variação e registre entradas, saídas, ajustes e devoluções.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <EstoqueStatusFilterTabs value={status as EstoqueFiltro} onChange={setStatus} />
        <SearchInput
          defaultValue={busca}
          onChange={setBusca}
          placeholder="Buscar por produto ou SKU..."
          className="w-full sm:w-64"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-2">
        <EstoqueTable
          itens={itens}
          isLoading={isLoading}
          onRowClick={setItemVisualizando}
          onMovimentar={setItemMovimentando}
        />
      </div>

      <MovimentacaoFormDialog
        open={!!itemMovimentando}
        onOpenChange={(open) => !open && setItemMovimentando(null)}
        item={itemMovimentando}
        onSubmit={handleSubmit}
        loading={registrar.isPending}
      />

      <HistoricoDialog
        open={!!itemVisualizando}
        onOpenChange={(open) => !open && setItemVisualizando(null)}
        item={itemVisualizando}
        onMovimentar={() => {
          if (itemVisualizando) {
            setItemMovimentando(itemVisualizando)
            setItemVisualizando(null)
          }
        }}
      />
    </div>
  )
}
