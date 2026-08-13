import Link from 'next/link'
import { MenuIcon } from 'lucide-react'

import type { CategoriaPublica } from '@/lib/loja/types'

export function NavCategorias({ categorias }: { categorias: CategoriaPublica[] }) {
  const raizes = categorias.filter((c) => c.parent_id === null).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))

  if (raizes.length === 0) return null

  return (
    <nav className="bg-primary">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
        <Link
          href="/produtos"
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-white/15"
        >
          <MenuIcon className="size-4" />
          Todas as categorias
        </Link>
        {raizes.map((c) => (
          <Link
            key={c.id}
            href={`/categoria/${c.slug}`}
            className="shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-white/15"
          >
            {c.nome}
          </Link>
        ))}
      </div>
    </nav>
  )
}
