'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CategoriaNode } from '@/lib/category-tree'

export type Categoria = CategoriaNode

export type CategoriaFormValues = {
  nome: string
  slug: string
  parent_id: string | null
  descricao: string
  ativo: boolean
  // Prefixo do codigo de produto (decisao #18). Vazio = servidor deriva
  // do nome e persiste; string = valor digitado manualmente.
  prefixo_codigo: string
}

// Mesmo motivo do Cidades: sessao httpOnly, entao as mutations passam
// pelas Route Handlers (que leem a sessao no servidor), nao pelo
// client do browser.
async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

// Busca a arvore inteira de uma vez (sem filtro no servidor): o
// filtro de status/busca e aplicado no cliente pra poder preservar o
// caminho ate a raiz dos nos que batem (ver lib/category-tree.ts).
export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: async (): Promise<Categoria[]> => {
      const response = await fetch('/api/painel/categorias')
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
  })
}

export function useCreateCategoria() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CategoriaFormValues) => {
      const response = await fetch('/api/painel/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      toast.success('Categoria criada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Nao foi possivel criar a categoria.'),
  })
}

export function useUpdateCategoria() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CategoriaFormValues }) => {
      const response = await fetch(`/api/painel/categorias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      toast.success('Categoria atualizada com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Nao foi possivel atualizar a categoria.'),
  })
}

export function useSetCategoriaAtivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`/api/painel/categorias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo }),
      })
      await parseJsonOrThrow(response)
      return ativo
    },
    onSuccess: (ativo) => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      toast.success(ativo ? 'Categoria reativada.' : 'Categoria inativada.')
    },
    onError: () => toast.error('Nao foi possivel atualizar o status da categoria.'),
  })
}
