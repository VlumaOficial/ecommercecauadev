// Pagina TEMPORARIA so' pra verificar que src/proxy.ts anexa o
// header de tenant certo por host, de verdade, num Server Component
// real (nao da pra observar isso via curl - o header e' de REQUEST,
// nunca aparece na response). Remover depois do teste da Fase 0 -
// nao faz parte da Vitrine.
import { getTenantFromHeaders } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function DebugTenantPage() {
  const tenant = await getTenantFromHeaders()
  return (
    <pre style={{ padding: 24, fontFamily: 'monospace' }}>
      {JSON.stringify({ tenant }, null, 2)}
    </pre>
  )
}
