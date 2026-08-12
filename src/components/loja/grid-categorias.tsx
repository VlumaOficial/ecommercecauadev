import Link from 'next/link'

import { CategoriaIcon } from '@/components/loja/categoria-icon'
import type { CategoriaPublica } from '@/lib/loja/types'

export function GridCategorias({ categorias }: { categorias: CategoriaPublica[] }) {
  const raizes = categorias
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))

  if (raizes.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h2 className="mb-4 font-display text-xl font-bold text-foreground">Categorias</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {raizes.map((c) => (
          <Link
            key={c.id}
            href={`/categoria/${c.slug}`}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary hover:bg-secondary"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground">
              <CategoriaIcon nome={c.nome} className="size-5" />
            </div>
            <span className="text-sm font-medium text-foreground">{c.nome}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
