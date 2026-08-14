import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'

import { getTenantFromHeaders } from '@/lib/tenant'
import {
  getPublicCategories,
  getPublicProducts,
  getPublicStoreSettings,
  getPreviewVitrine,
  mesclarRascunhoNoPublicado,
} from '@/lib/loja/rpc'
import { corTextoContraste } from '@/lib/loja/cor'
import { Header } from '@/components/loja/header'
import { NavCategorias } from '@/components/loja/nav-categorias'
import { BannerHero } from '@/components/loja/banner-hero'
import { SelosConfianca } from '@/components/loja/selos-confianca'
import { GridCategorias } from '@/components/loja/grid-categorias'
import { ProductGrid } from '@/components/loja/product-grid'
import { Footer } from '@/components/loja/footer'
import { WhatsAppFloatButton } from '@/components/loja/whatsapp-float-button'

// Nunca indexar - link de posse (token na URL), nao um endereco
// publico de verdade.
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Rota de PREVIEW (Etapa 4, Parte 2) - fora do route group (loja),
// DE PROPOSITO: o layout de (loja) so' le settings PUBLICADO, e nunca
// deve aprender a ler rascunho (superficie de auditoria minima pra
// garantir que rascunho nunca vaza pra anonimo). Esta pagina e' a
// UNICA no projeto que chama getPreviewVitrine().
//
// Sem sessao de staff aqui (cookie de auth nao atravessa do host do
// painel pro host da loja) - a barreira de seguranca e' 100% o token
// de posse validado dentro de get_preview_vitrine (SECURITY DEFINER,
// migration 031): token errado/expirado/de outro tenant = null =
// 404, sem distincao de motivo.
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const tenant = await getTenantFromHeaders()
  if (!tenant) notFound()

  const { token } = await searchParams
  if (!token) notFound()

  const [rascunho, publicado] = await Promise.all([
    getPreviewVitrine(tenant.slug, token),
    getPublicStoreSettings(tenant.slug),
  ])
  if (!rascunho || !publicado) notFound()

  const settings = mesclarRascunhoNoPublicado(publicado, rascunho)

  const [categorias, produtos] = await Promise.all([
    getPublicCategories(tenant.slug),
    getPublicProducts(tenant.slug),
  ])
  const destaques = produtos.filter((p) => p.destaque)

  const temaStyle: CSSProperties = {
    ['--primary' as string]: settings.cor_principal,
    ['--ring' as string]: settings.cor_principal,
    ['--primary-foreground' as string]: corTextoContraste(settings.cor_principal),
  }

  return (
    <div className="loja-theme flex min-h-svh flex-col bg-background text-foreground" style={temaStyle}>
      <div className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">
        MODO PRÉVIA — mostrando o rascunho, não publicado. Ninguém mais vê isto.
      </div>
      <Header nomeLoja={settings.nome} valorMinimoPedido={settings.valor_minimo_pedido} logoPath={settings.logo_path} />
      <NavCategorias categorias={categorias} />
      <main className="flex-1">
        <BannerHero settings={settings} />
        <SelosConfianca selos={settings.selos} />
        <GridCategorias categorias={categorias} />
        {destaques.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
            <h2 className="mb-4 font-display text-xl font-bold text-foreground">Destaques do criatório</h2>
            <ProductGrid produtos={destaques} categorias={categorias} />
          </section>
        )}
      </main>
      <Footer nomeLoja={settings.nome} logoPath={settings.logo_path} />
      <WhatsAppFloatButton numero={settings.whatsapp_numero} mensagem={settings.whatsapp_mensagem} />
    </div>
  )
}
