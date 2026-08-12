import { ProductCard } from '@/components/loja/product-card'
import type { ProdutoPublico } from '@/lib/loja/types'

export function ProductGrid({ produtos }: { produtos: ProdutoPublico[] }) {
  if (produtos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
        <p className="text-sm">Nenhum produto encontrado.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {produtos.map((produto) => (
        <ProductCard key={produto.id} produto={produto} />
      ))}
    </div>
  )
}
