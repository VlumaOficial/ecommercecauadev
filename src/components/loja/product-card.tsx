import Image from 'next/image'
import Link from 'next/link'
import { PackageIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatarMoeda } from '@/lib/utils'
import { urlImagemProduto } from '@/lib/loja/rpc'
import { ProductBadges } from '@/components/loja/product-badges'
import type { ProdutoPublico } from '@/lib/loja/types'

export function ProductCard({ produto, categoriaNome }: { produto: ProdutoPublico; categoriaNome?: string }) {
  return (
    <Link
      href={`/produto/${produto.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-sky-100 to-cyan-100">
        {produto.imagem_principal ? (
          <Image
            src={urlImagemProduto(produto.imagem_principal)}
            alt={produto.nome}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/70">
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
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {categoriaNome && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            {categoriaNome}
          </span>
        )}
        <p className="line-clamp-2 text-sm font-semibold text-foreground">{produto.nome}</p>
        <div className="mt-auto pt-1.5">
          {produto.preco_a_partir_de !== null ? (
            <>
              <p className="font-display text-lg font-extrabold text-foreground">
                {formatarMoeda(produto.preco_a_partir_de)}
              </p>
              <p className="text-xs text-muted-foreground">por {produto.unidade_venda}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Consulte</p>
          )}
        </div>
        <span
          className={cn(
            'mt-3 w-full rounded-lg py-2 text-center text-[13.5px] font-semibold transition-colors',
            produto.esgotado
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary text-primary-foreground group-hover:bg-[color-mix(in_oklab,var(--primary)_85%,black)]'
          )}
        >
          {produto.esgotado ? 'Indisponível' : 'Ver produto'}
        </span>
      </div>
    </Link>
  )
}
