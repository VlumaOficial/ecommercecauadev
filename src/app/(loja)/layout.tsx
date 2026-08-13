import { notFound } from 'next/navigation'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicCategories, getPublicStoreSettings } from '@/lib/loja/rpc'
import { Header } from '@/components/loja/header'
import { NavCategorias } from '@/components/loja/nav-categorias'
import { Footer } from '@/components/loja/footer'
import { LojaFechada } from '@/components/loja/loja-fechada'

// Host sem tenant resolvido (dominio nao cadastrado em tenant_domains,
// ou erro na RPC) = 404 - decisao tomada AQUI, nunca no proxy (que so'
// anexa headers, sempre fail-open). Ver src/lib/tenant.ts.
export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders()
  if (!tenant) notFound()

  const settings = await getPublicStoreSettings(tenant.slug)
  if (!settings) notFound()

  // Nivel 1 de fechamento (REGRAS_DE_NEGOCIO §2): loja_aberta=false =
  // cliente so' ve a mensagem, nem o catalogo aparece - sem header,
  // sem nav, sem footer.
  if (!settings.loja_aberta) {
    return (
      <div className="loja-theme min-h-svh bg-background text-foreground">
        <LojaFechada nomeLoja={settings.nome} mensagem={settings.mensagem_loja_fechada} />
      </div>
    )
  }

  const categorias = await getPublicCategories(tenant.slug)

  return (
    <div className="loja-theme flex min-h-svh flex-col bg-background text-foreground">
      <Header nomeLoja={settings.nome} valorMinimoPedido={settings.valor_minimo_pedido} />
      <NavCategorias categorias={categorias} />
      {!settings.pedidos_abertos && (
        <div className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-900 sm:px-6">
          {settings.mensagem_pedidos_fechados ?? 'Os pedidos deste ciclo ainda não começaram.'}
        </div>
      )}
      <main className="flex-1">{children}</main>
      <Footer nomeLoja={settings.nome} />
    </div>
  )
}
