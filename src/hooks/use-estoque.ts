'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

export type StatusEstoque = 'ok' | 'abaixo_do_minimo' | 'esgotado'
export type EstoqueFiltro = 'todos' | StatusEstoque

export type ItemEstoque = {
  id: string
  produto_id: string
  produto_nome: string
  variacao_nome: string
  sku: string | null
  saldo_estoque: number
  quantidade_minima: number
  status: StatusEstoque
}

export type TipoMovimentacao = Database['public']['Enums']['stock_movement_type']

export type MovimentoEstoque = {
  id: string
  tipo: TipoMovimentacao
  quantidade: number
  saldo_anterior: number
  saldo_novo: number
  motivo: string | null
  usuario_id: string | null
  usuario_nome: string
  created_at: string
}

export type MovimentacaoFormValues = {
  variant_id: string
  tipo: 'entrada' | 'saida' | 'ajuste' | 'devolucao'
  quantidade?: number
  saldo_novo_desejado?: number
  motivo: string
}

// Mesmo motivo de sempre: sessao httpOnly, mutations passam pelas
// Route Handlers, nunca client Supabase direto do browser.
async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useEstoque(params: { status: EstoqueFiltro; busca: string }) {
  return useQuery({
    queryKey: ['estoque', params.status, params.busca],
    queryFn: async (): Promise<ItemEstoque[]> => {
      const search = new URLSearchParams({ status: params.status, busca: params.busca })
      const response = await fetch(`/api/painel/estoque?${search.toString()}`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
  })
}

export function useRegistrarMovimentacao() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: MovimentacaoFormValues) => {
      const response = await fetch('/api/painel/estoque/movimentacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      queryClient.invalidateQueries({ queryKey: ['historico-estoque'] })
      toast.success('Movimentação registrada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível registrar a movimentação.'),
  })
}

export function useHistoricoEstoque(variantId: string | null) {
  return useQuery({
    queryKey: ['historico-estoque', variantId],
    queryFn: async (): Promise<MovimentoEstoque[]> => {
      const response = await fetch(`/api/painel/estoque/${variantId}/historico`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
    enabled: !!variantId,
  })
}
