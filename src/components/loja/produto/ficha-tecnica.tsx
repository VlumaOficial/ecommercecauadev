import type { ProdutoDetalheCaracteristica } from '@/lib/loja/types'

export function FichaTecnica({ caracteristicas }: { caracteristicas: ProdutoDetalheCaracteristica[] }) {
  if (caracteristicas.length === 0) return null

  return (
    <div>
      <h2 className="mb-2 font-display text-base font-bold text-foreground">Ficha técnica</h2>
      <dl className="divide-y divide-border rounded-lg border border-border">
        {caracteristicas.map((c) => (
          <div key={c.rotulo} className="flex justify-between gap-4 px-3 py-2 text-sm">
            <dt className="text-muted-foreground">{c.rotulo}</dt>
            <dd className="text-right font-medium text-foreground">{c.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
