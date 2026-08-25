import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Client com a SERVICE ROLE KEY - bypassa RLS por completo. `server-only`
// no topo quebra o BUILD se algum componente client ('use client')
// tentar importar este arquivo, mesmo transitivamente - defesa
// estrutural contra vazar a service role key pro bundle do browser, nao
// so uma convencao de comentario. Só Route Handlers usam isto, e só
// pelo caminho privilegiado de provisionamento de staff (correção do
// bug 46, ESCOPO_PROJETO.md §2/§0 item 49) - toda leitura/escrita comum
// do painel continua passando pelo client de sessão normal
// (src/lib/supabase/server.ts), que respeita RLS.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
