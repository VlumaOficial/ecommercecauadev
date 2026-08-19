import Link from 'next/link'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicStoreSettings, getPublicDeliveryCities } from '@/lib/loja/rpc'
import { Button } from '@/components/ui/button'
import { CadastroForm } from './cadastro-form'

export const dynamic = 'force-dynamic'

// Server Component: resolve tenant/config ANTES de renderizar, em vez
// do hook client-side (useDeliveryCities) que a tela usava antes -
// esse hook consultava delivery_cities direto pela tabela com sessao
// anonima, acesso que a migration 028 fechou (dropou
// cities_select_anon) sem RPC publica equivalente na epoca. Resultado
// real, confirmado ao vivo: o dropdown de cidade ficava sempre vazio
// pra qualquer visitante, cadastro de cliente nao dava pra concluir.
// Corrigido usando get_public_delivery_cities (migration 032, Fase 2
// incremento 1) - ja resolvida aqui no servidor, sem sessao nenhuma.
//
// permite_autocadastro (migration 036, Fase 2 incremento 2): o
// lojista pode desligar autocadastro - checado aqui, antes de montar
// o formulario. Tenant nao resolvido (host fora de tenant_domains,
// caso raro) cai pro comportamento antigo: formulario aberto, sem
// cidade nenhuma pra escolher - login/cadastro nunca ficam bloqueados
// so por causa da resolucao de tenant (mesmo principio do layout).
export default async function CadastroPage() {
  const tenant = await getTenantFromHeaders()
  const [settings, cidades] = tenant
    ? await Promise.all([getPublicStoreSettings(tenant.slug), getPublicDeliveryCities(tenant.slug)])
    : [null, []]

  if (settings && !settings.permite_autocadastro) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] p-8 text-center">
        <h2 className="font-display text-xl font-bold text-primary mb-2">Cadastro fechado no momento</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {settings.nome} não está aceitando novos cadastros agora. Tente novamente mais tarde.
        </p>
        <Link href="/entrar">
          <Button variant="outline" className="w-full">Voltar para entrar</Button>
        </Link>
      </div>
    )
  }

  return <CadastroForm cidades={cidades} />
}
