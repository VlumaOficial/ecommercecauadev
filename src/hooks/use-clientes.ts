'use client'

import { useQuery } from '@tanstack/react-query'
import type { Database } from '@/types/database'
import type { StatusFiltro } from '@/components/painel/crud/status-filter-tabs'

type OrderStatus = Database['public']['Enums']['order_status']

export type ClienteResumo = {
  id: string
  nome: string
  email: string
  whatsapp: string
  ativo: boolean
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
