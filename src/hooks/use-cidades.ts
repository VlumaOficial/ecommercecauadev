'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'
import type { StatusFiltro } from '@/components/painel/crud/status-filter-tabs'

export type Cidade = Tables<'delivery_cities'>

export type CidadeFormValues = {
  nome: string
  uf: string
  ponto_entrega: string
  horario: string
  observacoes: string
  ativo: boolean
}

// As mutations passam pelas Route Handlers em /api/painel/cidades (nao
// pelo client do browser): a sessao e httpOnly, entao o client do browser
// nunca teria um usuario autenticado para satisfazer a RLS de staff.
async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useCidades(params: { status: StatusFiltro; busca: string }) {
  return useQuery({
    queryKey: ['cidades', params.status, params.busca],
    queryFn: async (): Promise<Cidade[]> => {
      const search = new URLSearchParams({ status: params.status, busca: params.busca })
      const response = await fetch(`/api/painel/cidades?${search.toString()}`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
  })
}

export function useCreateCidade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CidadeFormValues) => {
      const response = await fetch('/api/painel/cidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cidades'] })
      toast.success('Cidade criada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Nao foi possivel criar a cidade.'),
  })
}

export function useUpdateCidade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CidadeFormValues }) => {
      const response = await fetch(`/api/painel/cidades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cidades'] })
      toast.success('Cidade atualizada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Nao foi possivel atualizar a cidade.'),
  })
}

export function useSetCidadeAtivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`/api/painel/cidades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo }),
      })
      await parseJsonOrThrow(response)
      return ativo
    },
    onSuccess: (ativo) => {
      queryClient.invalidateQueries({ queryKey: ['cidades'] })
      toast.success(ativo ? 'Cidade reativada.' : 'Cidade inativada.')
    },
    onError: () => toast.error('Nao foi possivel atualizar o status da cidade.'),
  })
}
