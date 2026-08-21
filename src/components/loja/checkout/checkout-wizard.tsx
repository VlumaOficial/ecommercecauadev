'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2Icon, Loader2Icon, PackageIcon } from 'lucide-react'
import { toast } from 'sonner'

import { formatarMoeda } from '@/lib/utils'
import { urlImagemProduto } from '@/lib/loja/rpc'
import { createClient } from '@/lib/supabase/client'
import { useCarrinho, useCarrinhoRegras } from '@/components/loja/carrinho-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { CustomerProfile } from '@/lib/auth'
import type { CidadeEntregaPublica } from '@/lib/loja/types'
import type { ItemCarrinho } from '@/lib/loja/carrinho-store'

type Passo = 'identificacao' | 'entrega' | 'revisao'

const PASSOS: { id: Passo; titulo: string }[] = [
  { id: 'identificacao', titulo: 'Identificação' },
  { id: 'entrega', titulo: 'Entrega' },
  { id: 'revisao', titulo: 'Revisão' },
]

type PedidoConfirmado = {
  numero: number
  total: number
  itens: ItemCarrinho[]
  cidadeNome: string
}

function formatarWhatsapp(digitos: string) {
  const d = digitos.replace(/\D/g, '')
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// Fase 2, incremento 5 (Checkout). Passo a passo: gate de sessao (resolvido
// no Server Component da page.tsx) -> Identificação -> Entrega -> Revisão
// (bloqueio REAL de valor mínimo, diferente do aviso do carrinho) ->
// Confirmação. Estado do passo e' local (useState), nao na URL - testado
// com Chromium real e refeito de proposito: ?passo= via
// useQueryParamState (router.replace) faz o Server Component da rota
// re-executar a cada troca de passo (refaz getCustomerProfile +
// getPublicDeliveryCities), lento e sem necessidade nenhuma aqui (os
// dados ja estao carregados, o passo e' 100% decisao de UI).
export function CheckoutWizard({ cliente, cidades }: { cliente: CustomerProfile; cidades: CidadeEntregaPublica[] }) {
  const supabase = createClient()
  const itens = useCarrinho((s) => s.itens)
  const limparCarrinho = useCarrinho((s) => s.limparCarrinho)
  const regras = useCarrinhoRegras()

  const [passo, setPasso] = useState<Passo>('identificacao')
  const [cidadeId, setCidadeId] = useState(cliente.delivery_city_id ?? '')
  const [observacao, setObservacao] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [pedido, setPedido] = useState<PedidoConfirmado | null>(null)

  const total = itens.reduce((acc, i) => acc + (i.precoPromocional ?? i.preco) * i.quantidade, 0)
  const faltaParaMinimo =
    regras.valorMinimoPedidoHabilitado && total < regras.valorMinimoPedido
      ? regras.valorMinimoPedido - total
      : 0
  const cidadeEscolhida = cidades.find((c) => c.id === cidadeId) ?? null

  async function finalizar() {
    if (itens.length === 0 || !cidadeId || faltaParaMinimo > 0) return
    setFinalizando(true)

    const { data, error } = await supabase.rpc('criar_pedido', {
      p_modalidade_entrega: 'ponto_encontro',
      p_delivery_city_id: cidadeId,
      p_observacao_cliente: observacao.trim() || null,
      p_itens: itens.map((i) => ({ variant_id: i.variantId, quantidade: i.quantidade })),
    })

    setFinalizando(false)

    if (error || !data) {
      // Mensagens da RPC ja vem em portugues claro (REGRAS_DE_NEGOCIO.md §9)
      toast.error(error?.message || 'Não foi possível finalizar seu pedido. Tente novamente.')
      return
    }

    setPedido({
      numero: data.numero,
      total: data.total,
      itens,
      cidadeNome: cidadeEscolhida ? `${cidadeEscolhida.nome}${cidadeEscolhida.uf ? ' - ' + cidadeEscolhida.uf : ''}` : '',
    })
    limparCarrinho()
  }

  if (pedido) {
    return <ConfirmacaoPedido pedido={pedido} />
  }

  if (itens.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <p className="mb-4 text-sm text-muted-foreground">Seu carrinho está vazio.</p>
        <Link href="/produtos">
          <Button>Ver produtos</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <IndicadorPassos passoAtual={passo} />

      {passo === 'entrega' ? (
        <PassoEntrega
          cidades={cidades}
          cidadeId={cidadeId}
          onEscolherCidade={setCidadeId}
          onVoltar={() => setPasso('identificacao')}
          onContinuar={() => setPasso('revisao')}
        />
      ) : passo === 'revisao' ? (
        <PassoRevisao
          itens={itens}
          cidadeEscolhida={cidadeEscolhida}
          observacao={observacao}
          onObservacaoChange={setObservacao}
          total={total}
          faltaParaMinimo={faltaParaMinimo}
          valorMinimoPedido={regras.valorMinimoPedido}
          finalizando={finalizando}
          onVoltar={() => setPasso('entrega')}
          onFinalizar={finalizar}
        />
      ) : (
        <PassoIdentificacao cliente={cliente} onContinuar={() => setPasso('entrega')} />
      )}
    </div>
  )
}

function IndicadorPassos({ passoAtual }: { passoAtual: Passo }) {
  const indiceAtual = PASSOS.findIndex((p) => p.id === passoAtual)
  return (
    <ol className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
      {PASSOS.map((p, i) => (
        <li key={p.id} className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= indiceAtual ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm font-medium ${i === indiceAtual ? 'text-foreground' : 'text-muted-foreground'}`}>
              {p.titulo}
            </span>
          </div>
          {i < PASSOS.length - 1 && <span className="h-px w-6 bg-border sm:w-10" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}

function PassoIdentificacao({ cliente, onContinuar }: { cliente: CustomerProfile; onContinuar: () => void }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] sm:p-8">
      <h1 className="font-display text-lg font-bold text-primary mb-1">Identificação</h1>
      <p className="text-sm text-muted-foreground mb-6">Confirme seus dados antes de continuar.</p>

      <dl className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Nome</dt>
          <dd className="font-medium text-foreground">{cliente.nome}</dd>
        </div>
        {cliente.email && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium text-foreground">{cliente.email}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">WhatsApp</dt>
          <dd className="font-medium text-foreground">{formatarWhatsapp(cliente.whatsapp)}</dd>
        </div>
      </dl>

      <Button onClick={onContinuar} className="mt-6 h-11 w-full text-base">
        Continuar
      </Button>
    </div>
  )
}

function PassoEntrega({
  cidades,
  cidadeId,
  onEscolherCidade,
  onVoltar,
  onContinuar,
}: {
  cidades: CidadeEntregaPublica[]
  cidadeId: string
  onEscolherCidade: (id: string) => void
  onVoltar: () => void
  onContinuar: () => void
}) {
  const cidade = cidades.find((c) => c.id === cidadeId) ?? null

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] sm:p-8">
      <h1 className="font-display text-lg font-bold text-primary mb-1">Entrega</h1>
      <p className="text-sm text-muted-foreground mb-6">Retirada combinada no ponto de encontro da sua cidade.</p>

      <Select value={cidadeId} onValueChange={(v) => onEscolherCidade(v ?? '')}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={cidades.length === 0 ? 'Nenhuma cidade disponível' : 'Selecione sua cidade'}>
            {(value: string | null) => {
              const c = cidades.find((x) => x.id === value)
              return c ? `${c.nome}${c.uf ? ' - ' + c.uf : ''}` : ''
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {cidades.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome}
              {c.uf ? ` - ${c.uf}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {cidade && (cidade.ponto_entrega || cidade.horario || cidade.observacoes) && (
        <div className="mt-4 space-y-1 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          {cidade.ponto_entrega && (
            <p>
              <span className="font-medium text-foreground">Ponto de encontro:</span> {cidade.ponto_entrega}
            </p>
          )}
          {cidade.horario && (
            <p>
              <span className="font-medium text-foreground">Horário:</span> {cidade.horario}
            </p>
          )}
          {cidade.observacoes && <p>{cidade.observacoes}</p>}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button onClick={onVoltar} variant="outline" className="h-11 flex-1 text-base">
          Voltar
        </Button>
        <Button onClick={onContinuar} disabled={!cidadeId} className="h-11 flex-1 text-base">
          Continuar
        </Button>
      </div>
    </div>
  )
}

function PassoRevisao({
  itens,
  cidadeEscolhida,
  observacao,
  onObservacaoChange,
  total,
  faltaParaMinimo,
  valorMinimoPedido,
  finalizando,
  onVoltar,
  onFinalizar,
}: {
  itens: ItemCarrinho[]
  cidadeEscolhida: CidadeEntregaPublica | null
  observacao: string
  onObservacaoChange: (v: string) => void
  total: number
  faltaParaMinimo: number
  valorMinimoPedido: number
  finalizando: boolean
  onVoltar: () => void
  onFinalizar: () => void
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] sm:p-8">
      <h1 className="font-display text-lg font-bold text-primary mb-1">Revisão</h1>
      <p className="text-sm text-muted-foreground mb-6">Confira seu pedido antes de finalizar.</p>

      <ul className="mb-4 flex flex-col gap-3">
        {itens.map((item) => {
          const preco = item.precoPromocional ?? item.preco
          return (
            <li key={item.variantId} className="flex gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {item.imagemPath ? (
                  <Image src={urlImagemProduto(item.imagemPath)} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
                    <PackageIcon className="size-5" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.productNome}</p>
                  {item.variantNome !== 'Padrão' && (
                    <p className="text-xs text-muted-foreground">{item.variantNome}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Qtd: {item.quantidade}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatarMoeda(preco * item.quantidade)}</span>
              </div>
            </li>
          )
        })}
      </ul>

      {cidadeEscolhida && (
        <p className="mb-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Entrega em:</span> {cidadeEscolhida.nome}
          {cidadeEscolhida.uf ? ` - ${cidadeEscolhida.uf}` : ''}
        </p>
      )}

      <div className="mb-4 space-y-2">
        <label htmlFor="observacao" className="text-sm font-medium text-foreground">
          Observação (opcional)
        </label>
        <Textarea
          id="observacao"
          value={observacao}
          onChange={(e) => onObservacaoChange(e.target.value)}
          placeholder="Alguma informação para o vendedor?"
          rows={2}
        />
      </div>

      <div className="mb-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="font-display text-lg font-extrabold text-foreground">{formatarMoeda(total)}</span>
      </div>

      {faltaParaMinimo > 0 && (
        <p className="mb-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-900">
          Faltam {formatarMoeda(faltaParaMinimo)} para o pedido mínimo de {formatarMoeda(valorMinimoPedido)}. Volte à
          loja e adicione mais itens ao carrinho.
        </p>
      )}

      <div className="flex gap-3">
        <Button onClick={onVoltar} variant="outline" className="h-11 flex-1 text-base" disabled={finalizando}>
          Voltar
        </Button>
        <Button onClick={onFinalizar} disabled={finalizando || faltaParaMinimo > 0} className="h-11 flex-1 text-base">
          {finalizando && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          Finalizar pedido
        </Button>
      </div>
    </div>
  )
}

function ConfirmacaoPedido({ pedido }: { pedido: PedidoConfirmado }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)]">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-secondary">
          <CheckCircle2Icon className="size-7 text-primary" />
        </div>
        <h1 className="font-display text-xl font-bold text-primary mb-2">Pedido recebido!</h1>
        <p className="text-sm text-muted-foreground mb-1">Seu pedido foi registrado com o número</p>
        <p className="font-display mb-4 text-3xl font-extrabold text-foreground">#{pedido.numero}</p>
        <p className="mb-6 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-900">
          Anote o número do seu pedido — ainda não temos e-mail de confirmação nem uma área para consultar pedidos
          nesta fase da loja.
        </p>

        <div className="mb-6 space-y-2 rounded-lg bg-muted/50 p-4 text-left text-sm">
          <p>
            <span className="font-medium text-foreground">Entrega em:</span> {pedido.cidadeNome}
          </p>
          <p>
            <span className="font-medium text-foreground">Itens:</span> {pedido.itens.length}
          </p>
          <p>
            <span className="font-medium text-foreground">Total:</span> {formatarMoeda(pedido.total)}
          </p>
          <p className="text-muted-foreground">O vendedor vai confirmar seu pedido em breve.</p>
        </div>

        <Link href="/produtos">
          <Button className="h-11 w-full text-base">Voltar à loja</Button>
        </Link>
      </div>
    </div>
  )
}
