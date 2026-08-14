import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { getTenantFromHeaders } from '@/lib/tenant'
import {
  getPublicCategories,
  getPublicProductDetail,
  getPublicStoreSettings,
  urlImagemProduto,
  urlLogoLoja,
} from '@/lib/loja/rpc'
import { getPath } from '@/lib/loja/category-tree'
import { Breadcrumb } from '@/components/loja/breadcrumb'
import { Galeria } from '@/components/loja/produto/galeria'
import { VariacoesSelector } from '@/components/loja/produto/variacoes-selector'
import { FichaTecnica } from '@/components/loja/produto/ficha-tecnica'

// Open Graph do produto (Etapa 4, Parte 4) - substitui por completo o
// fallback de (loja)/layout.tsx (titulo/descricao/imagem do produto,
// nao da loja). metadataBase herdado do layout. title.absolute pelo
// mesmo motivo do layout: o template "%s | Criatório Capuã" do
// layout raiz é uma marca fixa que não faz sentido pra um tenant
// futuro (Fase SaaS) com nome diferente - o sufixo certo é sempre o
// nome REAL da loja (settings.nome), nunca hardcoded.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tenant = await getTenantFromHeaders()
  if (!tenant) return {}
  const { slug } = await params
  const [produto, settings] = await Promise.all([
    getPublicProductDetail(tenant.slug, slug),
    getPublicStoreSettings(tenant.slug),
  ])
  if (!produto) return {}

  const imagemProduto = produto.imagens.find((img) => img.principal && img.variant_id === null)
  const imagem = imagemProduto ? urlImagemProduto(imagemProduto.storage_path) : urlLogoLoja(settings?.logo_path ?? null)
  const titulo = settings ? `${produto.nome} — ${settings.nome}` : produto.nome

  return {
    title: { absolute: titulo },
    description: produto.descricao ?? undefined,
    openGraph: {
      title: titulo,
      description: produto.descricao ?? undefined,
      images: [{ url: imagem }],
      locale: 'pt_BR',
      type: 'website',
    },
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
            {caminho.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {caminho.map((c) => c.nome).join(' › ')}
              </p>
            )}
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-[28px]">
              {produto.nome}
            </h1>
            {produto.codigo && (
              <p className="mt-1 font-mono text-xs text-muted-foreground/80">Cód. {produto.codigo}</p>
            )}
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
