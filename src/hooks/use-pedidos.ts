'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

export type PedidoStatus = Database['public']['Enums']['order_status']
export type PedidoStatusFiltro = PedidoStatus | 'todos'

export type PedidoResumo = {
  id: string
  numero: number
  status: PedidoStatus
  total: number
  created_at: string
  cliente_nome: string
  cidade_nome: string | null
  cidade_uf: string | null
}

export type PedidoItemDetalhe = {
  variant_id: string
  product_id: string
  produto_nome: string
  variacao_nome: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  // Saldo ATUAL da variacao (nao o saldo no momento do pedido) - o
  // vendedor precisa ver o que existe agora pra decidir se
  // valida/reduz, nao um historico (REGRAS_DE_NEGOCIO.md §20).
  saldo_estoque: number
}

export type PedidoDetalhe = {
  id: string
  numero: number
  status: PedidoStatus
  modalidade_entrega: string
  data_prevista: string | null
  data_efetiva: string | null
  observacao_cliente: string | null
  // So vem preenchida quando pode_gerenciar=true - a Route Handler
  // nunca inclui esse campo pra staff sem permissao (mesmo padrao de
  // defesa em profundidade ja usado no resto do projeto).
  observacao_interna: string | null
  motivo_cancelamento: string | null
  total: number
  created_at: string
  cliente: { nome: string; whatsapp: string; email: string | null }
  cidade: { nome: string; uf: string | null; ponto_entrega: string | null; horario: string | null } | null
  itens: PedidoItemDetalhe[]
  // staff_pode_gerenciar_pedidos() (migration 039) refletido aqui pra
  // UI decidir o que mostrar - as RPCs conferem de novo no servidor,
  // isto e' so pra esconder acoes que o backend recusaria de qualquer
  // forma.
  pode_gerenciar: boolean
}

async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

// As RPCs de validar/editar/cancelar/concluir devolvem a linha de
// `orders` atualizada - aplicar esses campos direto no cache faz a
// tela (badge de status, acoes disponiveis, total) reagir na hora, em
// vez de esperar o round-trip extra do invalidateQueries (que ainda
// roda, por baixo, pra re-sincronizar itens/estoque - a RPC nao
// devolve isso). Sem essa mescla, um clique em "Validar" por exemplo
// mostra o toast de sucesso mas a tela so troca pra "Confirmado"
// alguns segundos depois, quando o refetch invalidado termina -
// achado testando com Chromium real (a pagina recarregada do zero ja
// mostrava o status certo, confirmando que era so' o timing do
// re-render, nao um bug de cache no servidor).
function mesclarPedidoNoCache(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  ordem: Partial<
    Pick<PedidoDetalhe, 'status' | 'total' | 'data_prevista' | 'data_efetiva' | 'motivo_cancelamento' | 'observacao_interna'>
  >
) {
  queryClient.setQueryData<PedidoDetalhe>(['pedido', id], (atual) => (atual ? { ...atual, ...ordem } : atual))
}

export function usePedidos(status: PedidoStatusFiltro) {
  return useQuery({
    queryKey: ['pedidos', status],
    queryFn: async (): Promise<PedidoResumo[]> => {
      const response = await fetch(`/api/painel/pedidos?status=${status}`)
      const body = await parseJsonOrThrow(response)
      return body.data ?? []
    },
  })
}

export function usePedido(id: string) {
  return useQuery({
    queryKey: ['pedido', id],
    queryFn: async (): Promise<PedidoDetalhe> => {
      const response = await fetch(`/api/painel/pedidos/${id}`)
      const body = await parseJsonOrThrow(response)
      return body.data
    },
    enabled: !!id,
  })
}

export function useValidarPedido() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data_prevista }: { id: string; data_prevista: string | null }) => {
      const response = await fetch(`/api/painel/pedidos/${id}/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_prevista }),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: (data, { id }) => {
      mesclarPedidoNoCache(queryClient, id, data.data)
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      toast.success('Pedido validado — o estoque foi baixado e o cliente será notificado.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível validar o pedido.'),
  })
}

export function useAjustarPedido() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, itens }: { id: string; itens: { variant_id: string; quantidade: number }[] }) => {
      const response = await fetch(`/api/painel/pedidos/${id}/editar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: (data, { id }) => {
      mesclarPedidoNoCache(queryClient, id, data.data)
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      toast.success('Pedido ajustado — o cliente será notificado da mudança.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível ajustar o pedido.'),
  })
}

export function useCancelarPedido() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const response = await fetch(`/api/painel/pedidos/${id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: (data, { id }) => {
      mesclarPedidoNoCache(queryClient, id, data.data)
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      toast.success('Pedido cancelado — o cliente será notificado.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível cancelar o pedido.'),
  })
}

export function useConcluirPedido() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/painel/pedidos/${id}/concluir`, { method: 'POST' })
      return parseJsonOrThrow(response)
    },
    onSuccess: (data, id) => {
      mesclarPedidoNoCache(queryClient, id, data.data)
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      toast.success('Pedido marcado como concluído.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível concluir o pedido.'),
  })
}

export function useAtualizarObservacaoInterna() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao: string }) => {
      const response = await fetch(`/api/painel/pedidos/${id}/observacao-interna`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao }),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: (data, { id }) => {
      mesclarPedidoNoCache(queryClient, id, data.data)
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      toast.success('Anotação salva.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar a anotação.'),
  })
}
