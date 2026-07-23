import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Client administrativo. IGNORA RLS.
 * Uso restrito a Route Handlers e Server Actions.
 * NUNCA importar em Client Components.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
