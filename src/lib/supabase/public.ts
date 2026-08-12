import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Client publico/anonimo pra Vitrine ((loja)/**) - sem cookies, sem
// sessao. So chama as RPCs get_public_*/resolve_tenant_by_host
// (SECURITY DEFINER, migration 028), nunca tabela direta. Seguro pra
// usar em Server Component (nenhuma chamada de rede depende de auth).
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
