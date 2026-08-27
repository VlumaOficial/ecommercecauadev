'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2Icon, MinusIcon, PlusIcon, ShoppingCartIcon } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Preco } from '@/components/ui/preco'
import { useCarrinho, useCarrinhoRegras } from '@/components/loja/carrinho-provider'
import type { ProdutoDetalheVariacao } from '@/lib/loja/types'

export function VariacoesSelector({
  variacoes,
  produtoId,
  produtoNome,
  produtoSlug,
  imagemPath,
}: {
  variacoes: ProdutoDetalheVariacao[]
  produtoId: string
  produtoNome: string
  produtoSlug: string
  imagemPath: string | null
}) {
  const primeiraDisponivel = variacoes.find((v) => v.disponivel) ?? variacoes[0] ?? null
  const [selecionadaId, setSelecionadaId] = useState<string | null>(primeiraDisponivel?.id ?? null)

  const selecionada = useMemo(
    () => variacoes.find((v) => v.id === selecionadaId) ?? null,
    [variacoes, selecionadaId]
  )

  const [quantidade, setQuantidade] = useState(selecionada?.quantidade_minima_venda ?? 1)

  const adicionarItem = useCarrinho((s) => s.adicionarItem)
  const regras = useCarrinhoRegras()

  function selecionar(v: ProdutoDetalheVariacao) {
    setSelecionadaId(v.id)
    setQuantidade(v.quantidade_minima_venda)
  }

  const minimo = selecionada?.quantidade_minima_venda ?? 1
  const podeAdicionar = !!selecionada && selecionada.disponivel

  // Bloqueio de pedidos fechados (REGRAS_DE_NEGOCIO.md §11.3/§2): a
  // vitrine continua 100% navegavel com pedidos_abertos=false - o
  // bloqueio so acontece aqui, no momento de adicionar ao carrinho,
  // nunca antes. loja_aberta=false nem chega nesta tela (tratado no
  // (loja)/layout.tsx).
  function adicionarAoCarrinho() {
    if (!selecionada || !podeAdicionar) return

    if (!regras.pedidosAbertos) {
      toast.error(regras.mensagemPedidosFechados ?? 'Os pedidos deste ciclo ainda não começaram.')
      return
    }

    adicionarItem(
      {
        variantId: selecionada.id,
        productId: produtoId,
        productSlug: produtoSlug,
        productNome: produtoNome,
        variantNome: selecionada.nome,
        imagemPath,
        preco: selecionada.preco,
        precoPromocional: selecionada.preco_promocional,
        quantidadeMinimaVenda: selecionada.quantidade_minima_venda,
      },
      quantidade
    )
    toast.success('Adicionado ao carrinho!')
  }

  return (
    <div className="flex flex-col gap-5">
      {variacoes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            {variacoes.length > 1 || variacoes[0]?.nome !== 'Padrão' ? 'Variação' : 'Opção'}
          </p>
          <div className="flex flex-wrap gap-2">
            {variacoes.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={!v.disponivel}
                onClick={() => selecionar(v)}
                className={cn(
                  'flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors',
                  v.id === selecionadaId ? 'border-primary bg-secondary' : 'border-border hover:border-primary/50',
                  !v.disponivel && 'cursor-not-allowed opacity-50'
                )}
              >
                <span className="text-sm font-medium text-foreground">{v.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {v.preco_promocional ? (
                    <>
                      <Preco valor={v.preco} inline className="line-through" />{' '}
                      <Preco valor={v.preco_promocional} inline className="font-semibold text-primary" />
                    </>
                  ) : (
                    <Preco valor={v.preco} inline />
                  )}
                  {!v.disponivel && ' · esgotado'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selecionada && (
        <div>
          {selecionada.preco_promocional && (
            <Preco
              valor={selecionada.preco}
              inline
              className="block text-sm text-muted-foreground line-through"
            />
          )}
          <Preco
            valor={selecionada.preco_promocional ?? selecionada.preco}
            className="text-3xl font-extrabold text-foreground sm:text-[32px]"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-border">
          <button
            type="button"
            disabled={!podeAdicionar || quantidade <= minimo}
            onClick={() => setQuantidade((q) => Math.max(minimo, q - 1))}
            className="flex size-9 items-center justify-center text-foreground disabled:opacity-40"
            aria-label="Diminuir quantidade"
          >
            <MinusIcon className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium tabular-nums">{quantidade}</span>
          <button
            type="button"
            disabled={!podeAdicionar}
            onClick={() => setQuantidade((q) => q + 1)}
            className="flex size-9 items-center justify-center text-foreground disabled:opacity-40"
            aria-label="Aumentar quantidade"
          >
            <PlusIcon className="size-4" />
          </button>
        </div>

        <Button size="lg" disabled={!podeAdicionar} className="flex-1" onClick={adicionarAoCarrinho}>
          <ShoppingCartIcon className="size-4" />
          {podeAdicionar ? 'Adicionar ao carrinho' : 'Esgotado'}
        </Button>
      </div>
      <div className="-mt-2 flex flex-col gap-1">
        {podeAdicionar && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
            <CheckCircle2Icon className="size-4" />
            Disponível
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {minimo > 1 ? `Compra mínima: ${minimo} unidades · ` : ''}Retirada combinada por cidade
        </p>
      </div>
    </div>
  )
}
