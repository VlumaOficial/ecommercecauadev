import type { ProdutoDetalheCaracteristica } from '@/lib/loja/types'

export function FichaTecnica({ caracteristicas }: { caracteristicas: ProdutoDetalheCaracteristica[] }) {
  if (caracteristicas.length === 0) return null

  return (
    <div className="mt-2 border-t border-border pt-5">
      <h2 className="mb-3 font-display text-base font-bold text-foreground">Ficha técnica</h2>
      <dl>
        {caracteristicas.map((c) => (
          <div key={c.rotulo} className="flex gap-4 border-b border-border py-2 text-sm">
            <dt className="w-40 shrink-0 text-muted-foreground">{c.rotulo}</dt>
            <dd className="font-medium text-foreground">{c.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
