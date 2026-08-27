'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// Melhoria de notificação (c), REGRAS_DE_NEGOCIO.md §18.6c — config de
// quem da equipe recebe o aviso de "pedido novo". Mesmo padrão de
// use-configuracoes.ts (query + mutation, toasts). O card
// NotificacoesPedidoCard consome isto; fluxo/save próprios, separado do
// form de Configurações (item 4).

export type NotificacaoPedidoStaff = {
  profile_id: string
  nome: string
  tem_whatsapp: boolean
  ativo: boolean
  canal_email: boolean
  canal_whatsapp: boolean
}

export type NotificacaoPedidoPayload = Pick<
  NotificacaoPedidoStaff,
  'profile_id' | 'ativo' | 'canal_email' | 'canal_whatsapp'
>

// 403 = não é admin: não é "erro", é um estado esperado (o card mostra
// um aviso em vez da lista). Qualquer outro !ok vira exceção.
export function useNotificacoesPedido() {
  return useQuery({
    queryKey: ['notificacoes-pedido'],
    queryFn: async (): Promise<{ restrito: boolean; lista: NotificacaoPedidoStaff[] }> => {
      const response = await fetch('/api/painel/configuracoes/notificacoes-pedido')
      if (response.status === 403) return { restrito: true, lista: [] }
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(body?.error ?? 'Não foi possível carregar as configurações de notificação.')
      }
      return { restrito: false, lista: body.data ?? [] }
    },
  })
}

export function useSalvarNotificacoesPedido() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (lista: NotificacaoPedidoPayload[]) => {
      const response = await fetch('/api/painel/configuracoes/notificacoes-pedido', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lista),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(body?.error ?? 'Não foi possível salvar as configurações de notificação.')
      }
      return body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes-pedido'] })
      toast.success('Configurações de notificação salvas.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar.'),
  })
}
