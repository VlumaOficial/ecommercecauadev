'use client'

import { InfoIcon, Loader2Icon } from 'lucide-react'
import { useConfiguracaoVitrine } from '@/hooks/use-configuracao-vitrine'
import { VitrineForm } from './vitrine-form'

export function VitrineConfigView() {
  const { data, isLoading, isError } = useConfiguracaoVitrine()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2Icon className="mr-2 size-5 animate-spin" />
        Carregando configurações...
      </div>
    )
  }

  if (isError || !data) {
    return <p className="py-24 text-center text-destructive">Não foi possível carregar as configurações da vitrine.</p>
  }

  const temRascunho = !!data.rascunho

  return (
    <div>
      {temRascunho && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            Há um rascunho salvo, ainda não publicado. O formulário abaixo está mostrando o rascunho - use{' '}
            <b>Visualizar</b> pra conferir como fica antes de <b>Publicar</b>.
          </p>
        </div>
      )}
      <VitrineForm valoresIniciais={data.rascunho ?? data.publicado} />
    </div>
  )
}
