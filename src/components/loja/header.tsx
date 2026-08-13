import Image from 'next/image'
import Link from 'next/link'
import { TruckIcon, UserIcon } from 'lucide-react'

import { formatarMoeda } from '@/lib/utils'
import { SearchForm } from '@/components/loja/search-form'
import { CartButton } from '@/components/loja/cart-button'

export function Header({ nomeLoja, valorMinimoPedido }: { nomeLoja: string; valorMinimoPedido: number }) {
  return (
    <>
      <div className="bg-[color-mix(in_oklab,var(--primary)_88%,black)] px-4 py-2 text-center text-xs text-primary-foreground sm:px-6 sm:text-[13px]">
        <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5">
          <TruckIcon className="hidden size-3.5 shrink-0 sm:inline" />
          Retirada combinada por cidade
          {valorMinimoPedido > 0 && (
            <>
              <span aria-hidden className="opacity-60">
                ·
              </span>
              <b className="font-bold">Pedido mínimo {formatarMoeda(valorMinimoPedido)}</b>
            </>
          )}
          <span aria-hidden className="opacity-60">
            ·
          </span>
          Peixes com garantia de chegada viva
        </span>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image src="/brand/logocp-icone.png" alt="" width={34} height={27} className="h-7 w-auto sm:h-8" priority />
            <span className="font-display text-lg font-extrabold tracking-tight text-primary sm:text-xl">
              {nomeLoja}
            </span>
          </Link>

          <div className="hidden flex-1 sm:block">
            <SearchForm />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/entrar"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <UserIcon className="size-4" />
              <span className="hidden sm:inline">Entrar</span>
            </Link>
            <CartButton />
          </div>
        </div>
        <div className="px-4 pb-3 sm:hidden">
          <SearchForm />
        </div>
      </header>
    </>
  )
}
