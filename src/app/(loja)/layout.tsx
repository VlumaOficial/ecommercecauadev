import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicStoreSettings, getPublicCategories, urlArquivoLoja, urlLogoLoja } from '@/lib/loja/rpc'
import { corTextoContraste } from '@/lib/loja/cor'
import { Header } from '@/components/loja/header'
import { NavCategorias } from '@/components/loja/nav-categorias'
import { Footer } from '@/components/loja/footer'
import { LojaFechada } from '@/components/loja/loja-fechada'
import { WhatsAppFloatButton } from '@/components/loja/whatsapp-float-button'

// Open Graph dinamico por tenant (Vitrine Fase 1 Etapa 4, Parte 4) -
// fallback pra toda pagina de (loja) que nao define o proprio
// generateMetadata (home, listagem, categoria); produto/[slug] tem o
// seu (titulo/descricao do produto), que substitui este por completo,
// nao mescla campo a campo. Sempre le PUBLICADO (nunca rascunho) -
// preview de link e' algo publico por natureza (WhatsApp/redes
// buscam sem sessao nenhuma), rascunho nunca pode aparecer aqui.
//
// metadataBase resolvido pelo host da propria requisicao (nao um env
// fixo) porque cada tenant tem seu proprio dominio (tenant_domains) -
// e' o que permite usar o caminho relativo do logo estatico
// (/brand/logocp-icone.png) como og:image sem precisar saber o host
// de antemao.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantFromHeaders()
  if (!tenant) return {}

  const settings = await getPublicStoreSettings(tenant.slug)
  if (!settings) return {}

  const host = (await headers()).get('host')
  const metadataBase = host ? new URL(`https://${host}`) : undefined

  const imagem =
    settings.banner_tipo_fundo === 'imagem' && settings.banner_imagem_path
      ? urlArquivoLoja(settings.banner_imagem_path)
      : urlLogoLoja(settings.logo_path)

  return {
    title: settings.nome,
    description: settings.banner_subtitulo,
    metadataBase,
    openGraph: {
      title: settings.nome,
      description: settings.banner_subtitulo,
      images: [{ url: imagem }],
      locale: 'pt_BR',
      type: 'website',
    },
  }
}

// Host sem tenant resolvido (dominio nao cadastrado em tenant_domains,
// ou erro na RPC) = 404 - decisao tomada AQUI, nunca no proxy (que so'
// anexa headers, sempre fail-open). Ver src/lib/tenant.ts.
export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders()
  if (!tenant) notFound()

  const settings = await getPublicStoreSettings(tenant.slug)
  if (!settings) notFound()

  // Etapa 3 (migration 030): cor_principal alimenta --primary/--ring
  // do tema via style inline (maior especificidade que a classe
  // .loja-theme em globals.css, então sobrescreve o teal fixo sem
  // tocar nos outros tokens - secondary/accent continuam neutros).
  // --primary-foreground calculado por contraste, não fica gravado.
  const temaStyle: CSSProperties = {
    ['--primary' as string]: settings.cor_principal,
    ['--ring' as string]: settings.cor_principal,
    ['--primary-foreground' as string]: corTextoContraste(settings.cor_principal),
  }

  // Nivel 1 de fechamento (REGRAS_DE_NEGOCIO §2): loja_aberta=false =
  // cliente so' ve a mensagem, nem o catalogo aparece - sem header,
  // sem nav, sem footer.
  if (!settings.loja_aberta) {
    return (
      <div className="loja-theme min-h-svh bg-background text-foreground" style={temaStyle}>
        <LojaFechada nomeLoja={settings.nome} mensagem={settings.mensagem_loja_fechada} />
      </div>
    )
  }

  const categorias = await getPublicCategories(tenant.slug)

  return (
    <div className="loja-theme flex min-h-svh flex-col bg-background text-foreground" style={temaStyle}>
      <Header nomeLoja={settings.nome} valorMinimoPedido={settings.valor_minimo_pedido} logoPath={settings.logo_path} />
      <NavCategorias categorias={categorias} />
      {!settings.pedidos_abertos && (
        <div className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-900 sm:px-6">
          {settings.mensagem_pedidos_fechados ?? 'Os pedidos deste ciclo ainda não começaram.'}
        </div>
      )}
      <main className="flex-1">{children}</main>
      <Footer nomeLoja={settings.nome} logoPath={settings.logo_path} />
      <WhatsAppFloatButton numero={settings.whatsapp_numero} mensagem={settings.whatsapp_mensagem} />
    </div>
  )
}
