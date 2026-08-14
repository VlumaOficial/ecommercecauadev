'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ConfiguracaoVitrineCampos } from '@/lib/loja/types'

export type ConfiguracaoVitrine = {
  nome: string
  publicado: ConfiguracaoVitrineCampos
  rascunho: ConfiguracaoVitrineCampos | null
}

// Mesma logica das mutations de cidades/produtos: passa pelas Route
// Handlers em /api/painel/vitrine (sessao httpOnly, o client do
// browser nao teria usuario autenticado pra satisfazer is_staff()).
async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useConfiguracaoVitrine() {
  return useQuery({
    queryKey: ['configuracao-vitrine'],
    queryFn: async (): Promise<ConfiguracaoVitrine> => {
      const response = await fetch('/api/painel/vitrine')
      const body = await parseJsonOrThrow(response)
      return body.data
    },
  })
}

export function useSalvarRascunhoVitrine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campos: ConfiguracaoVitrineCampos) => {
      const response = await fetch('/api/painel/vitrine/rascunho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracao-vitrine'] })
      toast.success('Rascunho salvo.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar o rascunho.'),
  })
}

export function usePublicarVitrine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/painel/vitrine/publicar', { method: 'POST' })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracao-vitrine'] })
      toast.success('Publicado! As mudanças já estão no ar para os clientes.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível publicar.'),
  })
}

export function useGerarLinkPreview() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const response = await fetch('/api/painel/vitrine/preview-link', { method: 'POST' })
      const body = await parseJsonOrThrow(response)
      return body.data.url
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível gerar o link de prévia.'),
  })
}

export function useUploadImagemVitrine() {
  return useMutation({
    mutationFn: async ({ file, tipo }: { file: File; tipo: 'banner' | 'logo' }): Promise<string> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tipo', tipo)
      const response = await fetch('/api/painel/vitrine/upload', { method: 'POST', body: formData })
      const body = await parseJsonOrThrow(response)
      return body.data.path
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível enviar a imagem.'),
  })
}
