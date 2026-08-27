'use client'

import { Loader2Icon } from 'lucide-react'
import { useConfiguracoes } from '@/hooks/use-configuracoes'
import { ConfiguracoesForm } from './configuracoes-form'
import { NotificacoesPedidoCard } from './notificacoes-pedido-card'

export function ConfiguracoesView() {
  const { data, isLoading, isError } = useConfiguracoes()

  return (
    // pb extra: o form abaixo tem uma barra "Salvar" fixa no rodapé — o
    // card de Notificações (save próprio) precisa de espaço pra não ficar
    // atrás dela ao rolar até o fim.
    <div className="space-y-6 pb-28">
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2Icon className="mr-2 size-5 animate-spin" />
          Carregando configurações...
        </div>
      ) : isError || !data ? (
        <p className="py-24 text-center text-destructive">Não foi possível carregar as configurações.</p>
      ) : (
        <ConfiguracoesForm valoresIniciais={data} />
      )}

      <NotificacoesPedidoCard />
    </div>
  )
}
