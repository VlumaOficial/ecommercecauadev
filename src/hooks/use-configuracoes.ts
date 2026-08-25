'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ConfiguracoesCampos } from '@/lib/configuracoes/types'

async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useConfiguracoes() {
  return useQuery({
    queryKey: ['configuracoes'],
    queryFn: async (): Promise<ConfiguracoesCampos> => {
      const response = await fetch('/api/painel/configuracoes')
      const body = await parseJsonOrThrow(response)
      return body.data
    },
  })
}

export function useSalvarConfiguracoes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campos: ConfiguracoesCampos) => {
      const response = await fetch('/api/painel/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
      toast.success('Configurações salvas.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar as configurações.'),
  })
}
