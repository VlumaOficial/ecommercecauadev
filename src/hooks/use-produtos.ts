'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'
import type { StatusFiltro } from '@/components/painel/crud/status-filter-tabs'

export type Produto = Tables<'products_com_status'>
export type Variacao = Tables<'product_variants'>
export type ImagemProduto = Tables<'product_images'>
export type ProdutoDetalhe = Tables<'products'> & { variacoes: Variacao[]; imagens: ImagemProduto[] }

export type VariacaoFormValues = {
  // Presente = variacao ja existente (edicao); ausente = nova.
  id?: string
  nome: string
  sku: string
  preco: number
  preco_promocional: number | ''
  modo_estoque: 'quantitativo' | 'disponibilidade'
  // So editavel quando a variacao NASCE (produto novo, ou variacao
  // nova adicionada durante uma edicao) - vira movimentacao de
  // inventario na RPC (022), nunca grava saldo direto. Modulo de
  // Estoque.
  estoque_inicial: number | ''
  // So leitura: saldo atual de uma variacao JA EXISTENTE, pra exibir
  // no formulario de edicao (nunca enviado no payload - dali pra
  // frente so muda pelo modulo de Estoque).
  saldo_estoque?: number
  quantidade_minima: number
}

export type ProdutoFormValues = {
  category_id: string
  nome: string
  descricao: string
  unidade_venda_id: string
  destaque: boolean
  ativo: boolean
  codigo_modo: 'automatico' | 'categoria' | 'manual'
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
            unidade_venda_id: values.unidade_venda_id,
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

export function useProduto(id: string) {
  return useQuery({
    queryKey: ['produto', id],
    queryFn: async (): Promise<ProdutoDetalhe> => {
      const response = await fetch(`/api/painel/produtos/${id}`)
      const body = await parseJsonOrThrow(response)
      return body.data
    },
    enabled: !!id,
  })
}

export function useUpdateProduto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string
      values: Omit<ProdutoFormValues, 'codigo_modo' | 'codigo_manual'>
    }) => {
      const response = await fetch(`/api/painel/produtos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: {
            category_id: values.category_id,
            nome: values.nome,
            descricao: values.descricao,
            unidade_venda_id: values.unidade_venda_id,
            destaque: values.destaque,
            ativo: values.ativo,
            codigo_visivel: values.codigo_visivel,
          },
          variacoes: values.variacoes,
        }),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['produto', id] })
      toast.success('Produto atualizado com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível atualizar o produto.'),
  })
}

// Peek do codigo: so leitura, nao reserva nada. Dois modos (migration
// 024, decisao #24): "nome" reage ao nome do produto (modo automatico
// novo), "categoria" reage a categoria selecionada (modo "herdar da
// categoria", comportamento original desde a 016).
export type CodigoSugeridoParams =
  | { modo: 'nome'; nome: string }
  | { modo: 'categoria'; categoryId: string }

export function useCodigoSugerido(params: CodigoSugeridoParams) {
  const habilitado = params.modo === 'nome' ? params.nome.trim().length > 0 : !!params.categoryId

  return useQuery({
    queryKey:
      params.modo === 'nome'
        ? ['codigo-sugerido', 'nome', params.nome]
        : ['codigo-sugerido', 'categoria', params.categoryId],
    queryFn: async (): Promise<{ codigo: string; prefixo: string }> => {
      const search = new URLSearchParams({ modo: params.modo })
      if (params.modo === 'nome') search.set('nome', params.nome)
      else search.set('category_id', params.categoryId)
      const response = await fetch(`/api/painel/produtos/codigo-sugerido?${search.toString()}`)
      const body = await parseJsonOrThrow(response)
      return body.data
    },
    enabled: habilitado,
    retry: false,
  })
}
