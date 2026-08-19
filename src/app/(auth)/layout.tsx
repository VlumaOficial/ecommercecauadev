import type { CSSProperties } from 'react'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicStoreSettings } from '@/lib/loja/rpc'
import { corTextoContraste } from '@/lib/loja/cor'
import { AuthHeader } from '@/components/loja/auth-header'
import { VlumaFooter } from '@/components/vluma-footer'

// Casca compartilhada pelas 4 telas de auth (entrar/cadastro/
// recuperar-senha/nova-senha) - restilizada pro tema da vitrine
// (Fase 2, incremento 2). Diferente do layout de (loja) (que faz
// notFound() se o host nao resolver tenant nenhum), este layout NUNCA
// bloqueia: staff tambem usa /entrar pra logar, e login/cadastro
// nao pode quebrar so porque o host nao esta em tenant_domains (ex.
// dominio bruto do deploy, usado em debug). Sem tenant resolvido, cai
// pro tema neutro padrao do app (sem .loja-theme, sem branding) - a
// pagina continua 100% funcional, so sem a cor/logo do tenant.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders()
  const settings = tenant ? await getPublicStoreSettings(tenant.slug) : null

  const temaStyle: CSSProperties = settings
    ? {
        ['--primary' as string]: settings.cor_principal,
        ['--ring' as string]: settings.cor_principal,
        ['--primary-foreground' as string]: corTextoContraste(settings.cor_principal),
      }
    : {}

  return (
    <div
      className={
        settings
          ? 'loja-theme relative min-h-svh bg-background text-foreground'
          : 'relative min-h-svh bg-background text-foreground'
      }
      style={temaStyle}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-secondary to-background" />
      <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <AuthHeader nomeLoja={settings?.nome ?? null} logoPath={settings?.logo_path ?? null} />
          </div>
          {children}
          <div className="mt-8 flex justify-center">
            <VlumaFooter />
          </div>
        </div>
      </div>
    </div>
  )
}
