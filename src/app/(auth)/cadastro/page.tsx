import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicStoreSettings } from '@/lib/loja/rpc'
import { Button } from '@/components/ui/button'
import { CadastroForm } from './cadastro-form'

export const dynamic = 'force-dynamic'

// Server Component: resolve tenant/config ANTES de renderizar.
//
// Cidade de entrega NAO e' mais pedida aqui (decisao de produto,
// 24/08/2026, REGRAS_DE_NEGOCIO.md §14) - pertence ao checkout (onde
// o cliente decide onde receber a COMPRA), nao ao cadastro (so' cria
// a conta). get_public_delivery_cities (migration 032) deixou de ser
// necessaria nesta tela por isso.
//
// permite_autocadastro (migration 036, Fase 2 incremento 2): o
// lojista pode desligar autocadastro - checado aqui, antes de montar
// o formulario. Tenant nao resolvido (host fora de tenant_domains,
// caso raro) cai pro comportamento antigo: formulario aberto -
// login/cadastro nunca ficam bloqueados so por causa da resolucao de
// tenant (mesmo principio do layout).
export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const tenant = await getTenantFromHeaders()
  const settings = tenant ? await getPublicStoreSettings(tenant.slug) : null
  const { proximo } = await searchParams

  if (settings && !settings.permite_autocadastro) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] p-8 text-center">
        <h2 className="font-display text-xl font-bold text-primary mb-2">Cadastro fechado no momento</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {settings.nome} não está aceitando novos cadastros agora. Tente novamente mais tarde.
        </p>
        {/* <a> (não <Link>): navegação de documento pra /entrar (item 50). */}
        <Button variant="outline" className="w-full" render={<a href="/entrar" />}>
          Voltar para entrar
        </Button>
      </div>
    )
  }

  return <CadastroForm proximo={proximo} />
}
