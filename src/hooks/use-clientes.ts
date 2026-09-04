'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Database } from '@/types/database'
import type { StatusFiltro } from '@/components/painel/crud/status-filter-tabs'

type OrderStatus = Database['public']['Enums']['order_status']

export type ClienteResumo = {
  id: string
  nome: string
  email: string
  whatsapp: string
  ativo: boolean
  delivery_city_id: string | null
  observacoes: string | null
  cidade_nome: string | null
  cidade_uf: string | null
  // Só conta pedidos confirmado+concluido (venda de fato comprometida) -
  // mesmo criterio das metricas da ficha (Inc 1, Fase 3).
  numero_pedidos: number
}

export type ClientePedidoResumo = {
  id: string
  numero: number
  status: OrderStatus
  total: number
  created_at: string
}

export type ClienteDetalhe = {
  id: string
  nome: string
  email: string
  whatsapp: string
  ativo: boolean
  created_at: string
  delivery_city_id: string | null
  observacoes: string | null
  cidade: { nome: string; uf: string | null } | null
  metricas: {
    numero_pedidos: number
    total_gasto: number
    ticket_medio: number
    ultima_compra: string | null
    pedidos_cancelados: number
  }
  pedidos: ClientePedidoResumo[]
}

async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

// '' = todas as cidades, 'sem_cidade' = delivery_city_id null, ou o uuid da cidade.
export type ClienteFiltroCidade = string

export function useClientes(params: { status: StatusFiltro; busca: string; cidade: ClienteFiltroCidade }) {
  return useQuery({
    queryKey: ['clientes', params.status, params.busca, params.cidade],
    queryFn: async (): Promise<ClienteResumo[]> => {
      const search = new URLSearchParams({ status: params.status, busca: params.busca, cidade: params.cidade })
      const response = await fetch(`/api/painel/clientes?${search.toString()}`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
  })
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: ['cliente', id],
    queryFn: async (): Promise<ClienteDetalhe> => {
      const response = await fetch(`/api/painel/clientes/${id}`)
      const body = await parseJsonOrThrow(response)
      return body.data
    },
    enabled: !!id,
  })
}

// Fase 3, incremento 2 (aprovado pelo PO em 04/09/2026). Mesmo padrão de
// use-equipe.ts: mutations sempre via Route Handler (client servidor),
// nunca o client do browser.
export type ClienteFormValues = {
  nome: string
  email: string
  // Só dígitos (DDD+número, sem DDI) - obrigatório (diferente de staff).
  whatsapp: string
  delivery_city_id: string | null
  observacoes: string | null
}

function invalidarCliente(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: ['clientes'] })
  if (id) queryClient.invalidateQueries({ queryKey: ['cliente', id] })
}

export function useCreateCliente() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ClienteFormValues) => {
      const response = await fetch('/api/painel/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: (body) => {
      invalidarCliente(queryClient)
      toast.success(
        body.emailEnviado
          ? 'Cliente criado — enviamos um e-mail para ele definir a senha.'
          : 'Cliente criado, mas não conseguimos enviar o e-mail de senha agora — use "Reenviar link" na ficha.'
      )
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível criar o cliente.'),
  })
}

export function useUpdateCliente() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Omit<ClienteFormValues, 'email'> }) => {
      const response = await fetch(`/api/painel/clientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: (_body, { id }) => {
      invalidarCliente(queryClient, id)
      toast.success('Cliente atualizado.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível atualizar.'),
  })
}

export function useSetClienteAtivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`/api/painel/clientes/${id}/${ativo ? 'ativar' : 'desativar'}`, {
        method: 'POST',
      })
      await parseJsonOrThrow(response)
      return { id, ativo }
    },
    onSuccess: ({ id, ativo }) => {
      invalidarCliente(queryClient, id)
      toast.success(ativo ? 'Cliente reativado.' : 'Cliente desativado.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível atualizar o status.'),
  })
}

export function useReenviarSenhaCliente() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/painel/clientes/${id}/reenviar-senha`, { method: 'POST' })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => toast.success('Link de senha reenviado.'),
    onError: (error: Error) => toast.error(error.message || 'Não foi possível reenviar o link.'),
  })
}
