import { cn } from '@/lib/utils'
import { ProductCard } from '@/components/loja/product-card'
import type { CategoriaPublica, ProdutoPublico } from '@/lib/loja/types'

export function ProductGrid({
  produtos,
  categorias,
  variante = 'padrao',
}: {
  produtos: ProdutoPublico[]
  categorias?: CategoriaPublica[]
  variante?: 'padrao' | 'listagem'
}) {
  if (produtos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
        <p className="text-sm">Nenhum produto encontrado.</p>
      </div>
    )
  }

  const nomesPorCategoria = new Map(categorias?.map((c) => [c.id, c.nome]))

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:gap-4',
        variante === 'listagem' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
      )}
    >
      {produtos.map((produto) => (
        <ProductCard key={produto.id} produto={produto} categoriaNome={nomesPorCategoria.get(produto.category_id)} />
      ))}
    </div>
  )
}
