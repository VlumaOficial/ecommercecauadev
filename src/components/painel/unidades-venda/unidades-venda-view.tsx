'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQueryParamState } from '@/hooks/use-query-param-state'
import { StatusFilterTabs, type StatusFiltro } from '@/components/painel/crud/status-filter-tabs'
import { SearchInput } from '@/components/painel/crud/search-input'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { UnidadesVendaTable } from './unidades-venda-table'
import { UnidadeVendaFormDialog } from './unidade-venda-form-dialog'
import {
  useUnidadesVenda,
  useCreateUnidadeVenda,
  useUpdateUnidadeVenda,
  useSetUnidadeVendaAtivo,
  type UnidadeVenda,
  type UnidadeVendaFormValues,
} from '@/hooks/use-unidades-venda'

export function UnidadesVendaView() {
  const [status, setStatus] = useQueryParamState('status', 'ativos')
  const [busca, setBusca] = useQueryParamState('busca', '')

  const { data: unidades = [], isLoading } = useUnidadesVenda({
    status: status as StatusFiltro,
    busca,
  })

  const [formAberto, setFormAberto] = useState(false)
  const [unidadeEditando, setUnidadeEditando] = useState<UnidadeVenda | null>(null)
  const [unidadeParaInativar, setUnidadeParaInativar] = useState<UnidadeVenda | null>(null)

  const criar = useCreateUnidadeVenda()
  const atualizar = useUpdateUnidadeVenda()
  const setAtivo = useSetUnidadeVendaAtivo()

  function abrirNovo() {
    setUnidadeEditando(null)
    setFormAberto(true)
  }

  function abrirEdicao(unidade: UnidadeVenda) {
    setUnidadeEditando(unidade)
    setFormAberto(true)
  }

  function handleSubmit(values: UnidadeVendaFormValues) {
    if (unidadeEditando) {
      atualizar.mutate(
        { id: unidadeEditando.id, values },
        { onSuccess: () => setFormAberto(false) }
      )
    } else {
      criar.mutate(values, { onSuccess: () => setFormAberto(false) })
    }
  }

  function confirmarInativar() {
    if (!unidadeParaInativar) return
    setAtivo.mutate(
      { id: unidadeParaInativar.id, ativo: false },
      { onSuccess: () => setUnidadeParaInativar(null) }
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Unidades de venda</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as unidades disponíveis no cadastro de produtos (ex.: Unidade, Kg, Litro).
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <PlusIcon />
          Adicionar unidade
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

      <div className="rounded-2xl border border-border bg-card p-2">
        <UnidadesVendaTable
          unidades={unidades}
          isLoading={isLoading}
          onEdit={abrirEdicao}
          onInativar={setUnidadeParaInativar}
          onReativar={(unidade) => setAtivo.mutate({ id: unidade.id, ativo: true })}
        />
      </div>

      <UnidadeVendaFormDialog
        open={formAberto}
        onOpenChange={setFormAberto}
        unidade={unidadeEditando}
        onSubmit={handleSubmit}
        loading={criar.isPending || atualizar.isPending}
      />

      <ConfirmDialog
        open={!!unidadeParaInativar}
        onOpenChange={(open) => !open && setUnidadeParaInativar(null)}
        title="Inativar unidade de venda?"
        description={`"${unidadeParaInativar?.nome}" deixará de aparecer como opção para novos produtos até ser reativada. Produtos que já usam essa unidade não são afetados.`}
        confirmLabel="Inativar"
        destructive
        loading={setAtivo.isPending}
        onConfirm={confirmarInativar}
      />
    </div>
  )
}
