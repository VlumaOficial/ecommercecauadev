import Link from 'next/link'

import { SearchForm } from '@/components/loja/search-form'
import { CartButton } from '@/components/loja/cart-button'

export function Header({ nomeLoja }: { nomeLoja: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
        <Link href="/" className="shrink-0 font-display text-lg font-extrabold tracking-tight text-primary sm:text-xl">
          {nomeLoja}
        </Link>

        <div className="hidden flex-1 sm:block">
          <SearchForm />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/entrar"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Entrar
          </Link>
          <CartButton />
        </div>
      </div>
      <div className="px-4 pb-3 sm:hidden">
        <SearchForm />
      </div>
    </header>
  )
}
