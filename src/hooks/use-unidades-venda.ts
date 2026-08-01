'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'
import type { StatusFiltro } from '@/components/painel/crud/status-filter-tabs'

export type UnidadeVenda = Tables<'unidades_venda'>

export type UnidadeVendaFormValues = {
  nome: string
  ativo: boolean
}

// Mesmo motivo de Cidades/Categorias/Produtos: sessao httpOnly, mutations
// passam pelas Route Handlers, nunca client Supabase direto do browser.
async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useUnidadesVenda(params: { status: StatusFiltro; busca: string }) {
  return useQuery({
    queryKey: ['unidades-venda', params.status, params.busca],
    queryFn: async (): Promise<UnidadeVenda[]> => {
      const search = new URLSearchParams({ status: params.status, busca: params.busca })
      const response = await fetch(`/api/painel/unidades-venda?${search.toString()}`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
  })
}

export function useCreateUnidadeVenda() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: UnidadeVendaFormValues) => {
      const response = await fetch('/api/painel/unidades-venda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades-venda'] })
      toast.success('Unidade de venda criada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível criar a unidade de venda.'),
  })
}

export function useUpdateUnidadeVenda() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UnidadeVendaFormValues }) => {
      const response = await fetch(`/api/painel/unidades-venda/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades-venda'] })
      toast.success('Unidade de venda atualizada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível atualizar a unidade de venda.'),
  })
}

export function useSetUnidadeVendaAtivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`/api/painel/unidades-venda/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo }),
      })
      await parseJsonOrThrow(response)
      return ativo
    },
    onSuccess: (ativo) => {
      queryClient.invalidateQueries({ queryKey: ['unidades-venda'] })
      toast.success(ativo ? 'Unidade de venda reativada.' : 'Unidade de venda inativada.')
    },
    onError: () => toast.error('Não foi possível atualizar o status da unidade de venda.'),
  })
}

// Combobox de produto so precisa das ativas, sem paginacao/busca -
// lista curta (poucas unidades por tenant), igual combobox de categoria.
export function useUnidadesVendaAtivas() {
  return useQuery({
    queryKey: ['unidades-venda', 'ativos', ''],
    queryFn: async (): Promise<UnidadeVenda[]> => {
      const response = await fetch('/api/painel/unidades-venda?status=ativos&busca=')
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
  })
}
