'use client'

import { useMemo, useState } from 'react'
import { MinusIcon, PlusIcon, ShoppingCartIcon } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { formatarMoeda } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ProdutoDetalheVariacao } from '@/lib/loja/types'

export function VariacoesSelector({ variacoes }: { variacoes: ProdutoDetalheVariacao[] }) {
  const primeiraDisponivel = variacoes.find((v) => v.disponivel) ?? variacoes[0] ?? null
  const [selecionadaId, setSelecionadaId] = useState<string | null>(primeiraDisponivel?.id ?? null)

  const selecionada = useMemo(
    () => variacoes.find((v) => v.id === selecionadaId) ?? null,
    [variacoes, selecionadaId]
  )

  const [quantidade, setQuantidade] = useState(selecionada?.quantidade_minima_venda ?? 1)

  function selecionar(v: ProdutoDetalheVariacao) {
    setSelecionadaId(v.id)
    setQuantidade(v.quantidade_minima_venda)
  }

  const minimo = selecionada?.quantidade_minima_venda ?? 1
  const podeAdicionar = !!selecionada && selecionada.disponivel

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
                      <span className="line-through">{formatarMoeda(v.preco)}</span>{' '}
                      <span className="font-semibold text-primary">{formatarMoeda(v.preco_promocional)}</span>
                    </>
                  ) : (
                    formatarMoeda(v.preco)
                  )}
                  {!v.disponivel && ' · esgotado'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selecionada && (
        <div className="flex items-baseline gap-2">
          {selecionada.preco_promocional ? (
            <>
              <span className="font-display text-2xl font-extrabold text-primary">
                {formatarMoeda(selecionada.preco_promocional)}
              </span>
              <span className="text-sm text-muted-foreground line-through">{formatarMoeda(selecionada.preco)}</span>
            </>
          ) : (
            <span className="font-display text-2xl font-extrabold text-primary">{formatarMoeda(selecionada.preco)}</span>
          )}
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

        <Button
          size="lg"
          disabled={!podeAdicionar}
          className="flex-1"
          onClick={() => toast.info('O carrinho chega na próxima fase da Vitrine.')}
        >
          <ShoppingCartIcon className="size-4" />
          {podeAdicionar ? 'Adicionar ao carrinho' : 'Esgotado'}
        </Button>
      </div>
      {minimo > 1 && podeAdicionar && (
        <p className="-mt-2 text-xs text-muted-foreground">Quantidade mínima de compra: {minimo}</p>
      )}
    </div>
  )
}
