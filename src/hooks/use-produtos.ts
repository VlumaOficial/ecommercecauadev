'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'
import type { StatusFiltro } from '@/components/painel/crud/status-filter-tabs'

// Preenchido só quando a listagem tem busca ativa (GET
// /api/painel/produtos) - qual(is) variação(ões) do produto casaram
// com o texto digitado, e em qual campo (SKU e/ou rótulo), pra UI
// mostrar a variação sem o lojista precisar abrir o produto.
export type VariacaoEncontrada = {
  id: string
  nome: string
  sku: string | null
  bateu_sku: boolean
  bateu_nome: boolean
}

export type Produto = Tables<'products_com_status'> & {
  variacoes_encontradas?: VariacaoEncontrada[]
}
export type Variacao = Tables<'product_variants'>
export type ImagemProduto = Tables<'product_images'>
export type ValorCaracteristica = Tables<'product_attribute_values'>
export type ProdutoDetalhe = Tables<'products'> & {
  variacoes: Variacao[]
  imagens: ImagemProduto[]
  caracteristicas: ValorCaracteristica[]
}

// Payload enviado pra RPC (p_caracteristicas): um item por
// caracteristica ATIVA da categoria - o form monta essa lista a partir
// do Record<attribute_id, valor> (ver ProdutoFormValues.caracteristicas
// abaixo) cruzado com a lista de caracteristicas ativas da categoria
// selecionada, sempre incluindo as vazias (pra permitir limpar um
// valor ja preenchido, nao so preencher).
export type CaracteristicaPayload = { attribute_id: string; valor: string }

export type VariacaoFormValues = {
  // Presente = variacao ja existente (edicao); ausente = nova.
  id?: string
  nome: string
  sku: string
  // Vazio enquanto digita (CurrencyInput comeca sem valor pre-preenchido,
  // nao "0") - obrigatorio na validacao do schema (produto-form.tsx),
  // nunca chega '' de fato no payload enviado ao servidor.
  preco: number | ''
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
  // Dois minimos distintos (migration 027, decisao de produto
  // 07/08/2026): "quantidade_minima" era ambigua, servia tanto de
  // alerta de reposicao (modulo de Estoque) quanto seria a futura
  // regra de compra minima no checkout, sem nenhuma distincao.
  // estoque = nivel de alerta de reposicao ("abaixo do minimo").
  // venda = minimo de compra do cliente (checkout futuro, sem uso
  // ainda).
  quantidade_minima_estoque: number
  quantidade_minima_venda: number
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
  // Etapa 2 (Caracteristicas): attribute_id -> valor digitado. Chave
  // de acesso direto (nao array) porque os campos sao renderizados
  // dinamicamente por ProdutoCaracteristicasSection, um por
  // caracteristica ativa da categoria - nao precisa de semantica de
  // lista ordenada/insercao do useFieldArray, so leitura/escrita por
  // attribute_id. Convertido pra CaracteristicaPayload[] no submit.
  caracteristicas: Record<string, string>
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

// category_id -> quantidade de produtos, respeitando o status atual da
// listagem - alimenta o contador em cada nó da árvore de categoria do
// filtro (categoria-tree-filter.tsx).
export function useContagemProdutosPorCategoria(status: StatusFiltro) {
  return useQuery({
    queryKey: ['produtos-contagem-categoria', status],
    queryFn: async (): Promise<Record<string, number>> => {
      const response = await fetch(`/api/painel/produtos/contagem-por-categoria?status=${status}`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? {}
    },
  })
}

export function useCreateProduto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      values,
      caracteristicas,
    }: {
      values: ProdutoFormValues
      caracteristicas: CaracteristicaPayload[]
    }) => {
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
          caracteristicas,
        }),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      // Fica na tela (produto-form.tsx troca pra modo edicao) - a
      // mensagem já orienta o proximo passo (imagens so destravam
      // depois do produto existir), nao so confirma o "criado".
      toast.success('Produto salvo — agora você pode adicionar imagens.')
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
      caracteristicas,
    }: {
      id: string
      values: Omit<ProdutoFormValues, 'codigo_modo' | 'codigo_manual'>
      caracteristicas: CaracteristicaPayload[]
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
          caracteristicas,
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
