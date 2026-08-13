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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">Categorias</h2>
        <Link href="/produtos" className="text-sm font-semibold text-primary hover:underline">
          Ver todas →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {raizes.map((c) => (
          <Link
            key={c.id}
            href={`/categoria/${c.slug}`}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <CategoriaIcon nome={c.nome} className="size-9 text-primary" />
            <span className="text-[13.5px] font-semibold text-foreground">{c.nome}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
