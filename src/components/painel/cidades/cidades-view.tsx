'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQueryParamState } from '@/hooks/use-query-param-state'
import { StatusFilterTabs, type StatusFiltro } from '@/components/painel/crud/status-filter-tabs'
import { SearchInput } from '@/components/painel/crud/search-input'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { CidadesTable } from './cidades-table'
import { CidadeFormDialog } from './cidade-form-dialog'
import {
  useCidades,
  useCreateCidade,
  useUpdateCidade,
  useSetCidadeAtivo,
  type Cidade,
  type CidadeFormValues,
} from '@/hooks/use-cidades'

export function CidadesView() {
  const [status, setStatus] = useQueryParamState('status', 'ativos')
  const [busca, setBusca] = useQueryParamState('busca', '')

  const { data: cidades = [], isLoading } = useCidades({
    status: status as StatusFiltro,
    busca,
  })

  const [formAberto, setFormAberto] = useState(false)
  const [cidadeEditando, setCidadeEditando] = useState<Cidade | null>(null)
  const [cidadeParaInativar, setCidadeParaInativar] = useState<Cidade | null>(null)

  const criar = useCreateCidade()
  const atualizar = useUpdateCidade()
  const setAtivo = useSetCidadeAtivo()

  function abrirNovo() {
    setCidadeEditando(null)
    setFormAberto(true)
  }

  function abrirEdicao(cidade: Cidade) {
    setCidadeEditando(cidade)
    setFormAberto(true)
  }

  function handleSubmit(values: CidadeFormValues) {
    if (cidadeEditando) {
      atualizar.mutate(
        { id: cidadeEditando.id, values },
        { onSuccess: () => setFormAberto(false) }
      )
    } else {
      criar.mutate(values, { onSuccess: () => setFormAberto(false) })
    }
  }

  function confirmarInativar() {
    if (!cidadeParaInativar) return
    setAtivo.mutate(
      { id: cidadeParaInativar.id, ativo: false },
      { onSuccess: () => setCidadeParaInativar(null) }
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Cidades de entrega</h1>
          <p className="text-muted-foreground mt-1">Gerencie as cidades disponiveis para entrega.</p>
        </div>
        <Button onClick={abrirNovo}>
          <PlusIcon />
          Adicionar cidade
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
        <CidadesTable
          cidades={cidades}
          isLoading={isLoading}
          onEdit={abrirEdicao}
          onInativar={setCidadeParaInativar}
          onReativar={(cidade) => setAtivo.mutate({ id: cidade.id, ativo: true })}
        />
      </div>

      <CidadeFormDialog
        open={formAberto}
        onOpenChange={setFormAberto}
        cidade={cidadeEditando}
        onSubmit={handleSubmit}
        loading={criar.isPending || atualizar.isPending}
      />

      <ConfirmDialog
        open={!!cidadeParaInativar}
        onOpenChange={(open) => !open && setCidadeParaInativar(null)}
        title="Inativar cidade?"
        description={`"${cidadeParaInativar?.nome}" deixara de aparecer para novos pedidos ate ser reativada.`}
        confirmLabel="Inativar"
        destructive
        loading={setAtivo.isPending}
        onConfirm={confirmarInativar}
      />
    </div>
  )
}
