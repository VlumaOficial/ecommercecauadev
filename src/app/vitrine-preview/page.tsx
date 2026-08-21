import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { getTenantSlug } from '@/lib/tenant'
import {
  getPublicCategories,
  getPublicProducts,
  getPublicStoreSettings,
  mesclarRascunhoNoPublicado,
} from '@/lib/loja/rpc'
import { corTextoContraste } from '@/lib/loja/cor'
import type { ConfiguracaoVitrineCampos } from '@/lib/loja/types'
import { Header } from '@/components/loja/header'
import { NavCategorias } from '@/components/loja/nav-categorias'
import { BannerHero } from '@/components/loja/banner-hero'
import { SelosConfianca } from '@/components/loja/selos-confianca'
import { GridCategorias } from '@/components/loja/grid-categorias'
import { ProductGrid } from '@/components/loja/product-grid'
import { Footer } from '@/components/loja/footer'
import { WhatsAppFloatButton } from '@/components/loja/whatsapp-float-button'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Rota de PREVIEW (Etapa 4, Parte 2 - revisada em 14/08/2026 pra
// sessao, nao token) - de proposito FORA de src/app/painel/**, pra
// nao herdar o layout com sidebar (o preview precisa renderizar a
// vitrine de verdade, full-bleed, nao encaixada dentro do shell do
// painel) - mesmo assim protegida pela MESMA sessao de staff
// (getStaffProfile(), mesmo padrao de painel/layout.tsx), rodando no
// MESMO host/deploy do painel (nao no host da loja - tenant do
// painel e' resolvido por current_tenant_id()/env, nao por host, ver
// src/lib/tenant.ts). Sem sessao = redirect pro login, igual
// qualquer rota de /painel/**. rascunho lido via get_configuracao_vitrine
// (RPC de staff, migration 031) com o client AUTENTICADO do proprio
// request - nunca com o client publico/anon.
export default async function VitrinePreviewPage() {
  const perfil = await getStaffProfile()
  if (!perfil) redirect('/entrar?proximo=/vitrine-preview')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_configuracao_vitrine')
  const config = !error && data && data.length > 0 ? data[0] : null
  const rascunho = (config?.rascunho as ConfiguracaoVitrineCampos | null) ?? null

  const tenantSlug = getTenantSlug()
  const publicado = await getPublicStoreSettings(tenantSlug)

  if (!rascunho || !publicado) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="font-display text-xl font-bold text-foreground">Nenhum rascunho salvo ainda</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Edite as configurações da vitrine e clique em &quot;Salvar rascunho&quot; ou &quot;Visualizar&quot; antes
          de abrir a prévia.
        </p>
      </div>
    )
  }

  const settings = mesclarRascunhoNoPublicado(publicado, rascunho)

  const [categorias, produtos] = await Promise.all([
    getPublicCategories(tenantSlug),
    getPublicProducts(tenantSlug),
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
        MODO PRÉVIA — mostrando o rascunho, não publicado. Só você (equipe logada) vê isto.
      </div>
      <Header nomeLoja={settings.nome} valorMinimoPedido={settings.valor_minimo_pedido} logoPath={settings.logo_path} cliente={null} />
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
