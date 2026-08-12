import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicCategories, getPublicProductDetail, urlImagemProduto } from '@/lib/loja/rpc'
import { getPath } from '@/lib/loja/category-tree'
import { Breadcrumb } from '@/components/loja/breadcrumb'
import { Galeria } from '@/components/loja/produto/galeria'
import { VariacoesSelector } from '@/components/loja/produto/variacoes-selector'
import { FichaTecnica } from '@/components/loja/produto/ficha-tecnica'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tenant = await getTenantFromHeaders()
  if (!tenant) return {}
  const { slug } = await params
  const produto = await getPublicProductDetail(tenant.slug, slug)
  if (!produto) return {}
  return {
    title: produto.nome,
    description: produto.descricao ?? undefined,
  }
}

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const tenant = await getTenantFromHeaders()
  if (!tenant) notFound()

  const { slug } = await params
  const [produto, categorias] = await Promise.all([
    getPublicProductDetail(tenant.slug, slug),
    getPublicCategories(tenant.slug),
  ])
  if (!produto) notFound()

  const caminho = getPath(produto.category_id, categorias)
  const breadcrumbItens = [
    ...caminho.map((c) => ({ label: c.nome, href: `/categoria/${c.slug}` })),
    { label: produto.nome },
  ]

  const imagensProduto = produto.imagens
    .filter((img) => img.variant_id === null)
    .map((img) => ({ url: urlImagemProduto(img.storage_path), alt: img.alt_text }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Breadcrumb itens={breadcrumbItens} />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Galeria imagens={imagensProduto} nomeProduto={produto.nome} />

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{produto.nome}</h1>
            {produto.codigo && <p className="mt-1 text-xs text-muted-foreground">Código: {produto.codigo}</p>}
          </div>

          <VariacoesSelector variacoes={produto.variacoes} />

          {produto.descricao && (
            <div>
              <h2 className="mb-1 font-display text-base font-bold text-foreground">Descrição</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{produto.descricao}</p>
            </div>
          )}

          <FichaTecnica caracteristicas={produto.caracteristicas} />
        </div>
      </div>
    </div>
  )
}
