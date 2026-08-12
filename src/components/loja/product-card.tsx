import Image from 'next/image'
import Link from 'next/link'
import { PackageIcon } from 'lucide-react'

import { formatarMoeda } from '@/lib/utils'
import { urlImagemProduto } from '@/lib/loja/rpc'
import { ProductBadges } from '@/components/loja/product-badges'
import type { ProdutoPublico } from '@/lib/loja/types'

export function ProductCard({ produto }: { produto: ProdutoPublico }) {
  return (
    <Link
      href={`/produto/${produto.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {produto.imagem_principal ? (
          <Image
            src={urlImagemProduto(produto.imagem_principal)}
            alt={produto.nome}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <PackageIcon className="size-10" />
          </div>
        )}
        <ProductBadges
          esgotado={produto.esgotado}
          emPromocao={produto.em_promocao}
          novidade={produto.novidade}
          className="absolute left-2 top-2"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{produto.nome}</p>
        <div className="mt-auto pt-1">
          {produto.preco_a_partir_de !== null ? (
            <p className="font-display text-base font-bold text-primary">
              {formatarMoeda(produto.preco_a_partir_de)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">/ {produto.unidade_venda}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Consulte</p>
          )}
        </div>
      </div>
    </Link>
  )
}
