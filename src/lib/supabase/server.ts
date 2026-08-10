import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
            )
          } catch {
            // Server Component (renderizacao de pagina/layout): cookies()
            // e' read-only aqui, cookieStore.set() lanca
            // ReadonlyRequestCookiesError - ignorado de proposito. Isso e'
            // esperado e inofensivo desde que src/proxy.ts (corrigido em
            // 10/08/2026) persista a renovacao primeiro, no mesmo request:
            // o Server Component ja le o cookie fresco encaminhado pelo
            // proxy, entao getUser() aqui normalmente nem tenta renovar de
            // novo. Em Route Handler (src/app/api/painel/**) o mesmo
            // setAll roda sem cair nesse catch - cookie store e' mutavel
            // la, a renovacao persiste normalmente.
          }
        },
      },
    }
  )
}
