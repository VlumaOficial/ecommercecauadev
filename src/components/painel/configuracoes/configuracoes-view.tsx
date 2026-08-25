'use client'

import { Loader2Icon } from 'lucide-react'
import { useConfiguracoes } from '@/hooks/use-configuracoes'
import { ConfiguracoesForm } from './configuracoes-form'

export function ConfiguracoesView() {
  const { data, isLoading, isError } = useConfiguracoes()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2Icon className="mr-2 size-5 animate-spin" />
        Carregando configurações...
      </div>
    )
  }

  if (isError || !data) {
    return <p className="py-24 text-center text-destructive">Não foi possível carregar as configurações.</p>
  }

  return <ConfiguracoesForm valoresIniciais={data} />
}
