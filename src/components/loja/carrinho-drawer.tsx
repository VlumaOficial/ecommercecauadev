'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MinusIcon, PlusIcon, ShoppingCartIcon, Trash2Icon, PackageIcon } from 'lucide-react'
import { toast } from 'sonner'

import { formatarMoeda } from '@/lib/utils'
import { urlImagemProduto } from '@/lib/loja/rpc'
import { useCarrinho, useCarrinhoRegras } from '@/components/loja/carrinho-provider'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'

// Icone do carrinho (com badge de contagem) + o drawer em si, num
// componente so' - o Sheet e' controlado localmente (sem precisar de
// contexto de "aberto/fechado" externo). Finalizar pedido continua
// placeholder neste incremento (vira real no incremento 5, Checkout).
export function CarrinhoDrawer() {
  const [open, setOpen] = useState(false)
  const itens = useCarrinho((s) => s.itens)
  const alterarQuantidade = useCarrinho((s) => s.alterarQuantidade)
  const removerItem = useCarrinho((s) => s.removerItem)
  const regras = useCarrinhoRegras()

  const contagem = itens.reduce((acc, i) => acc + i.quantidade, 0)
  const total = itens.reduce((acc, i) => acc + (i.precoPromocional ?? i.preco) * i.quantidade, 0)
  const faltaParaMinimo =
    regras.valorMinimoPedidoHabilitado && total < regras.valorMinimoPedido
      ? regras.valorMinimoPedido - total
      : 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        aria-label={`Carrinho${contagem > 0 ? `, ${contagem} item(ns)` : ''}`}
      >
        <ShoppingCartIcon className="size-5" />
        {contagem > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {contagem}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Seu carrinho{contagem > 0 ? ` (${contagem})` : ''}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4">
            {itens.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
                <ShoppingCartIcon className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
                <Link href="/produtos" onClick={() => setOpen(false)}>
                  <Button variant="outline">Ver produtos</Button>
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-4 py-2">
                {itens.map((item) => {
                  const preco = item.precoPromocional ?? item.preco
                  return (
                    <li key={item.variantId} className="flex gap-3">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                        {item.imagemPath ? (
                          <Image
                            src={urlImagemProduto(item.imagemPath)}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
                            <PackageIcon className="size-6" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/produto/${item.productSlug}`}
                              onClick={() => setOpen(false)}
                              className="text-sm font-medium text-foreground hover:underline"
                            >
                              {item.productNome}
                            </Link>
                            {item.variantNome !== 'Padrão' && (
                              <p className="text-xs text-muted-foreground">{item.variantNome}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removerItem(item.variantId)}
                            className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                            aria-label={`Remover ${item.productNome} do carrinho`}
                          >
                            <Trash2Icon className="size-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-border">
                            <button
                              type="button"
                              disabled={item.quantidade <= item.quantidadeMinimaVenda}
                              onClick={() => alterarQuantidade(item.variantId, item.quantidade - 1)}
                              className="flex size-7 items-center justify-center text-foreground disabled:opacity-40"
                              aria-label={`Diminuir quantidade de ${item.productNome}`}
                            >
                              <MinusIcon className="size-3.5" />
                            </button>
                            <span className="w-7 text-center text-xs font-medium tabular-nums">
                              {item.quantidade}
                            </span>
                            <button
                              type="button"
                              onClick={() => alterarQuantidade(item.variantId, item.quantidade + 1)}
                              className="flex size-7 items-center justify-center text-foreground"
                              aria-label={`Aumentar quantidade de ${item.productNome}`}
                            >
                              <PlusIcon className="size-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {formatarMoeda(preco * item.quantidade)}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {itens.length > 0 && (
            <SheetFooter className="border-t border-border">
              {faltaParaMinimo > 0 && (
                <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-900">
                  Faltam {formatarMoeda(faltaParaMinimo)} para o pedido mínimo de{' '}
                  {formatarMoeda(regras.valorMinimoPedido)}.
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="font-display text-lg font-extrabold text-foreground">
                  {formatarMoeda(total)}
                </span>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => toast.info('O checkout chega na próxima fase da Vitrine.')}
              >
                Finalizar pedido
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
