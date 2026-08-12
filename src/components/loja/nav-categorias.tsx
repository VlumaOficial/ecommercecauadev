import Link from 'next/link'

import type { CategoriaPublica } from '@/lib/loja/types'

export function NavCategorias({ categorias }: { categorias: CategoriaPublica[] }) {
  const raizes = categorias.filter((c) => c.parent_id === null).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))

  if (raizes.length === 0) return null

  return (
    <nav className="border-b border-border bg-secondary/40">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {raizes.map((c) => (
          <Link
            key={c.id}
            href={`/categoria/${c.slug}`}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {c.nome}
          </Link>
        ))}
      </div>
    </nav>
  )
}
