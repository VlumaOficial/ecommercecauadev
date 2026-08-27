'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Database, Tables } from '@/types/database'
import type { StatusFiltro } from '@/components/painel/crud/status-filter-tabs'

export type StaffMembro = Tables<'profiles'>
export type StaffRole = Database['public']['Enums']['user_role']

export type StaffCreateValues = {
  nome: string
  email: string
  // Só dígitos (DDD+número, sem DDI) ou '' quando não informado — mesma
  // convenção de customers.whatsapp. O Route Handler normaliza '' → null.
  whatsapp: string
  role: StaffRole
  pode_aceitar_pedido: boolean
}

export type StaffUpdateValues = {
  nome: string
  whatsapp: string
  role: StaffRole
  pode_aceitar_pedido: boolean
}

// Mesma lição de sempre: as mutations passam pelas Route Handlers em
// /api/painel/equipe (client servidor), não pelo client do browser -
// e o passo 1/2 de criação usa a service role dentro do Route Handler
// (nunca exposta aqui).
async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useEquipe(status: StatusFiltro) {
  return useQuery({
    queryKey: ['equipe', status],
    queryFn: async (): Promise<{ membros: StaffMembro[]; meuId: string }> => {
      const response = await fetch(`/api/painel/equipe?status=${status}`)
      const body = await parseJsonOrThrow(response)
      return { membros: body.data ?? [], meuId: body.meuId }
    },
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: StaffCreateValues) => {
      const response = await fetch('/api/painel/equipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: (body) => {
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
      toast.success(
        body.emailEnviado
          ? 'Membro da equipe criado — enviamos um e-mail para ele definir a senha.'
          : 'Membro da equipe criado, mas não conseguimos enviar o e-mail de senha agora — use "Reenviar link" na lista.'
      )
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível criar o membro da equipe.'),
  })
}

export function useUpdateStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: StaffUpdateValues }) => {
      const response = await fetch(`/api/painel/equipe/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
      toast.success('Membro da equipe atualizado.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível atualizar.'),
  })
}

export function useSetStaffAtivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`/api/painel/equipe/${id}/${ativo ? 'ativar' : 'desativar'}`, {
        method: 'POST',
      })
      await parseJsonOrThrow(response)
      return ativo
    },
    onSuccess: (ativo) => {
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
      toast.success(ativo ? 'Membro reativado.' : 'Membro desativado.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível atualizar o status.'),
  })
}

export function useReenviarSenhaStaff() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/painel/equipe/${id}/reenviar-senha`, { method: 'POST' })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => toast.success('Link de senha reenviado.'),
    onError: (error: Error) => toast.error(error.message || 'Não foi possível reenviar o link.'),
  })
}
