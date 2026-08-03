'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Ocorreu um erro inesperado.')
  }
  return body
}

export function useUploadImagem(produtoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      arquivo,
      variantId,
      altText,
    }: {
      arquivo: Blob
      variantId?: string
      altText?: string
    }) => {
      const formData = new FormData()
      formData.append('file', arquivo, 'imagem.webp')
      if (variantId) formData.append('variant_id', variantId)
      if (altText) formData.append('alt_text', altText)

      const response = await fetch(`/api/painel/produtos/${produtoId}/imagens`, {
        method: 'POST',
        body: formData,
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produto', produtoId] })
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível enviar a imagem.'),
  })
}

export function useReordenarImagens(produtoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch(`/api/painel/produtos/${produtoId}/imagens/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      return parseJsonOrThrow(response)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível salvar a nova ordem.')
      queryClient.invalidateQueries({ queryKey: ['produto', produtoId] })
    },
  })
}

export function useDefinirImagemPrincipal(produtoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (imageId: string) => {
      const response = await fetch(`/api/painel/produtos/${produtoId}/imagens/${imageId}/principal`, {
        method: 'POST',
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produto', produtoId] })
      toast.success('Capa definida com sucesso.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível definir a capa.'),
  })
}

export function useRemoverImagem(produtoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (imageId: string) => {
      const response = await fetch(`/api/painel/produtos/${produtoId}/imagens/${imageId}`, {
        method: 'DELETE',
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produto', produtoId] })
      toast.success('Imagem removida.')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível remover a imagem.'),
  })
}

export function useAtualizarAltTextImagem(produtoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ imageId, altText }: { imageId: string; altText: string }) => {
      const response = await fetch(`/api/painel/produtos/${produtoId}/imagens/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt_text: altText }),
      })
      return parseJsonOrThrow(response)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produto', produtoId] }),
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar a descrição da imagem.'),
  })
}
