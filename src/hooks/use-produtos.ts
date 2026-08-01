'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'
import type { StatusFiltro } from '@/components/painel/crud/status-filter-tabs'

export type Produto = Tables<'products_com_status'>

export type VariacaoFormValues = {
  nome: string
  sku: string
  preco: number
  preco_promocional: number | ''
  modo_estoque: 'quantitativo' | 'disponibilidade'
  saldo_estoque: number
  quantidade_minima: number
}

export type ProdutoFormValues = {
  category_id: string
  nome: string
  descricao: string
  unidade_venda: string
  destaque: boolean
  ativo: boolean
  codigo_modo: 'automatico' | 'manual'
  codigo_manual: string
  codigo_visivel: boolean
  variacoes: VariacaoFormValues[]
}

// Mesmo motivo de Cidades/Categorias: sessao httpOnly, mutations
// passam pelas Route Handlers, nunca client Supabase direto do browser.
async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useProdutos(params: { status: StatusFiltro; busca: string; categoryId: string }) {
  return useQuery({
    queryKey: ['produtos', params.status, params.busca, params.categoryId],
    queryFn: async (): Promise<Produto[]> => {
      const search = new URLSearchParams({ status: params.status, busca: params.busca })
      if (params.categoryId) search.set('category_id', params.categoryId)
      const response = await fetch(`/api/painel/produtos?${search.toString()}`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
  })
}

export function useCreateProduto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ProdutoFormValues) => {
      const response = await fetch('/api/painel/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: {
            category_id: values.category_id,
            nome: values.nome,
            descricao: values.descricao,
            unidade_venda: values.unidade_venda,
            destaque: values.destaque,
            ativo: values.ativo,
            codigo_visivel: values.codigo_visivel,
          },
          codigo_modo: values.codigo_modo,
          codigo_manual: values.codigo_manual,
          variacoes: values.variacoes,
        }),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      toast.success('Produto criado com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível criar o produto.'),
  })
}

export function useSetProdutoAtivo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`/api/painel/produtos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo }),
      })
      await parseJsonOrThrow(response)
      return ativo
    },
    onSuccess: (ativo) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      toast.success(ativo ? 'Produto reativado.' : 'Produto inativado.')
    },
    onError: () => toast.error('Não foi possível atualizar o status do produto.'),
  })
}

// Peek do codigo automatico: so leitura, nao reserva nada. Chamado
// toda vez que a categoria muda no formulario de criacao.
export function useCodigoSugerido(categoryId: string) {
  return useQuery({
    queryKey: ['codigo-sugerido', categoryId],
    queryFn: async (): Promise<{ codigo: string; prefixo: string }> => {
      const response = await fetch(`/api/painel/produtos/codigo-sugerido?category_id=${categoryId}`)
      const body = await parseJsonOrThrow(response)
      return body.data
    },
    enabled: !!categoryId,
    retry: false,
  })
}
