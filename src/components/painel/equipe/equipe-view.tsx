'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQueryParamState } from '@/hooks/use-query-param-state'
import { StatusFilterTabs, type StatusFiltro } from '@/components/painel/crud/status-filter-tabs'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { EquipeTable } from './equipe-table'
import { StaffFormDialog } from './staff-form-dialog'
import {
  useEquipe,
  useCreateStaff,
  useUpdateStaff,
  useSetStaffAtivo,
  useReenviarSenhaStaff,
  type StaffMembro,
} from '@/hooks/use-equipe'

export function EquipeView() {
  const [status, setStatus] = useQueryParamState('status', 'ativos')

  const { data, isLoading } = useEquipe(status as StatusFiltro)
  const membros = data?.membros ?? []
  const meuId = data?.meuId

  const [formAberto, setFormAberto] = useState(false)
  const [membroEditando, setMembroEditando] = useState<StaffMembro | null>(null)
  const [membroParaInativar, setMembroParaInativar] = useState<StaffMembro | null>(null)

  const criar = useCreateStaff()
  const atualizar = useUpdateStaff()
  const setAtivo = useSetStaffAtivo()
  const reenviarSenha = useReenviarSenhaStaff()

  function abrirNovo() {
    setMembroEditando(null)
    setFormAberto(true)
  }

  function abrirEdicao(membro: StaffMembro) {
    setMembroEditando(membro)
    setFormAberto(true)
  }

  function handleSubmit(values: {
    nome: string
    email: string
    whatsapp: string
    role: 'admin' | 'operador'
    pode_aceitar_pedido: boolean
  }) {
    if (membroEditando) {
      atualizar.mutate(
        {
          id: membroEditando.id,
          values: {
            nome: values.nome,
            whatsapp: values.whatsapp,
            role: values.role,
            pode_aceitar_pedido: values.pode_aceitar_pedido,
          },
        },
        { onSuccess: () => setFormAberto(false) }
      )
    } else {
      criar.mutate(values, { onSuccess: () => setFormAberto(false) })
    }
  }

  function confirmarInativar() {
    if (!membroParaInativar) return
    setAtivo.mutate({ id: membroParaInativar.id, ativo: false }, { onSuccess: () => setMembroParaInativar(null) })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Equipe</h1>
          <p className="text-muted-foreground mt-1">Gerencie quem tem acesso ao painel.</p>
        </div>
        <Button onClick={abrirNovo}>
          <PlusIcon />
          Adicionar membro
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <StatusFilterTabs value={status as StatusFiltro} onChange={setStatus} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-2">
        <EquipeTable
          membros={membros}
          meuId={meuId}
          isLoading={isLoading}
          onEdit={abrirEdicao}
          onInativar={setMembroParaInativar}
          onReativar={(membro) => setAtivo.mutate({ id: membro.id, ativo: true })}
          onReenviarSenha={(membro) => reenviarSenha.mutate(membro.id)}
        />
      </div>

      <StaffFormDialog
        open={formAberto}
        onOpenChange={setFormAberto}
        membro={membroEditando}
        travarPapel={!!membroEditando && membroEditando.id === meuId}
        onSubmit={handleSubmit}
        loading={criar.isPending || atualizar.isPending}
      />

      <ConfirmDialog
        open={!!membroParaInativar}
        onOpenChange={(open) => !open && setMembroParaInativar(null)}
        title="Desativar membro da equipe?"
        description={`"${membroParaInativar?.nome}" perde o acesso ao painel até ser reativado.`}
        confirmLabel="Desativar"
        destructive
        loading={setAtivo.isPending}
        onConfirm={confirmarInativar}
      />
    </div>
  )
}
