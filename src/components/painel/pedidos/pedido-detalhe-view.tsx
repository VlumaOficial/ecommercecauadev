'use client'

import Link from 'next/link'
import { ArrowLeftIcon, MessageCircleIcon } from 'lucide-react'
import { usePedido } from '@/hooks/use-pedidos'
import { Button } from '@/components/ui/button'
import { PedidoStatusBadge } from '@/components/loja/pedidos/status-badge'
import { PedidoItensSection } from './pedido-itens-section'
import { PedidoObservacaoInterna } from './pedido-observacao-interna'
import { PedidoAcoes } from './pedido-acoes'

// Formata os digitos do WhatsApp (armazenado sem mascara, DDD + numero
// - ver formatarWhatsapp em cadastro-form.tsx) so' pra EXIBICAO na
// tela; o link wa.me usa os digitos crus com o prefixo de pais.
function formatarWhatsappExibicao(digitos: string) {
  const d = digitos.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digitos
}

export function PedidoDetalheView({ id }: { id: string }) {
  const { data: pedido, isLoading, error } = usePedido(id)

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (error || !pedido) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {error?.message ?? 'Pedido não encontrado.'}
      </p>
    )
  }

  // Mesmo padrao de wa.me do whatsapp-float-button - numero armazenado
  // sem DDI (cadastro brasileiro, sem suporte a numero internacional
  // hoje), prefixo "55" aplicado so' na hora de montar o link.
  const whatsappDigitos = pedido.cliente.whatsapp.replace(/\D/g, '')
  const whatsappHref = whatsappDigitos
    ? `https://wa.me/55${whatsappDigitos}?text=${encodeURIComponent(`Olá ${pedido.cliente.nome}, sobre o seu pedido #${pedido.numero}...`)}`
    : null

  return (
    <div className="max-w-3xl">
      <Link
        href="/painel/pedidos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Pedidos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Pedido #{pedido.numero}</h1>
          <p className="text-sm text-muted-foreground">{new Date(pedido.created_at).toLocaleString('pt-BR')}</p>
        </div>
        <PedidoStatusBadge status={pedido.status} />
      </div>

      {pedido.status === 'cancelado' && pedido.motivo_cancelamento && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Motivo do cancelamento</p>
          <p className="text-muted-foreground">{pedido.motivo_cancelamento}</p>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Cliente</h2>
          <p className="text-sm text-foreground">{pedido.cliente.nome}</p>
          {pedido.cliente.email && <p className="text-sm text-muted-foreground">{pedido.cliente.email}</p>}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] hover:underline"
            >
              <MessageCircleIcon className="size-4" />
              {formatarWhatsappExibicao(pedido.cliente.whatsapp)}
            </a>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Entrega</h2>
          <p className="text-xs text-muted-foreground">Ponto de encontro</p>
          {pedido.cidade ? (
            <>
              <p className="text-sm text-foreground">
                {pedido.cidade.nome}
                {pedido.cidade.uf ? ` - ${pedido.cidade.uf}` : ''}
              </p>
              {pedido.cidade.ponto_entrega && (
                <p className="text-sm text-muted-foreground">{pedido.cidade.ponto_entrega}</p>
              )}
              {pedido.cidade.horario && (
                <p className="text-sm text-muted-foreground">Horário: {pedido.cidade.horario}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
          {(pedido.data_prevista || pedido.data_efetiva) && (
            <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-sm text-muted-foreground">
              {pedido.data_prevista && (
                <p>Prevista: {new Date(pedido.data_prevista).toLocaleDateString('pt-BR')}</p>
              )}
              {pedido.data_efetiva && <p>Efetiva: {new Date(pedido.data_efetiva).toLocaleString('pt-BR')}</p>}
            </div>
          )}
        </div>
      </div>

      <PedidoItensSection pedido={pedido} />

      {pedido.observacao_cliente && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Observação do cliente</h2>
          <p className="text-sm text-muted-foreground">{pedido.observacao_cliente}</p>
        </div>
      )}

      <PedidoObservacaoInterna
        pedidoId={pedido.id}
        valorInicial={pedido.observacao_interna}
        podeGerenciar={pedido.pode_gerenciar}
      />

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-6">
        <Link href="/painel/pedidos">
          <Button type="button" variant="outline">
            Voltar para pedidos
          </Button>
        </Link>
        <PedidoAcoes pedido={pedido} />
      </div>
    </div>
  )
}
