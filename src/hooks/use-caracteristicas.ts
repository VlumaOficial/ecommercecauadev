'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export type TipoCaracteristica = 'texto' | 'numero' | 'selecao' | 'booleano' | 'data'

// Sem heranca entre categorias nesta fase (cada categoria define as
// suas proprias caracteristicas). O modelo nao impede adicionar isso
// depois: categories.parent_id ja existe, entao heranca pode ser
// resolvida em tempo de consulta (buscar category_attributes da
// categoria + de todos os ancestrais), sem duplicar linhas nem
// migration nova. So exigiria coluna extra o dia que precisar de
// OVERRIDE de uma caracteristica herdada num nivel mais especifico
// (ex.: tornar opcional algo que o pai marcou obrigatorio) — decisao
// futura, nao bloqueia nada hoje.
export type Caracteristica = {
  id: string
  category_id: string
  chave: string
  rotulo: string
  tipo: TipoCaracteristica
  opcoes: string[] | null
  obrigatorio: boolean
  usar_em_filtro: boolean
  ordem: number
  ativo: boolean
}

export type CaracteristicaFormValues = {
  rotulo: string
  tipo: 'texto' | 'numero' | 'selecao' | 'booleano'
  opcoes: string[]
  obrigatorio: boolean
  usar_em_filtro: boolean
  ativo: boolean
}

// Mesmo motivo do resto do painel: sessao httpOnly, mutations passam
// pelas Route Handlers, nao pelo client do browser.
async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useCaracteristicas(categoryId: string | null) {
  return useQuery({
    queryKey: ['caracteristicas', categoryId],
    queryFn: async (): Promise<Caracteristica[]> => {
      const response = await fetch(`/api/painel/categorias/${categoryId}/caracteristicas`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
    enabled: !!categoryId,
  })
}

export function useCreateCaracteristica(categoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CaracteristicaFormValues) => {
      const response = await fetch(`/api/painel/categorias/${categoryId}/caracteristicas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caracteristicas', categoryId] })
      toast.success('Caracteristica criada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Nao foi possivel criar a caracteristica.'),
  })
}

export function useUpdateCaracteristica(categoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CaracteristicaFormValues }) => {
      const response = await fetch(`/api/painel/categorias/${categoryId}/caracteristicas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caracteristicas', categoryId] })
      toast.success('Caracteristica atualizada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Nao foi possivel atualizar a caracteristica.'),
  })
}

export function useSetCaracteristicaAtivo(categoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`/api/painel/categorias/${categoryId}/caracteristicas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo }),
      })
      await parseJsonOrThrow(response)
      return ativo
    },
    onSuccess: (ativo) => {
      queryClient.invalidateQueries({ queryKey: ['caracteristicas', categoryId] })
      toast.success(ativo ? 'Caracteristica reativada.' : 'Caracteristica inativada.')
    },
    onError: () => toast.error('Nao foi possivel atualizar o status da caracteristica.'),
  })
}

// Reordenacao otimista: o componente de lista ja reordena o estado
// local antes de chamar isso; aqui so persiste. Em erro, invalida a
// query pra resincronizar com o servidor (desfaz o drag visualmente).
export function useReordenarCaracteristicas(categoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch(`/api/painel/categorias/${categoryId}/caracteristicas/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      return parseJsonOrThrow(response)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Nao foi possivel salvar a nova ordem.')
      queryClient.invalidateQueries({ queryKey: ['caracteristicas', categoryId] })
    },
  })
}
