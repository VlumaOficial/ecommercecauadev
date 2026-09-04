import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url)
  const cookieStore = await cookies()
  // Destino do logout = VITRINE (`/`), único pra staff e cliente
  // (REGRAS_DE_NEGOCIO.md §8/§1.1). O form nativo da sidebar do painel
  // segue este 303 como navegação de documento (ignora o Router Cache).
  const response = NextResponse.redirect(`${origin}/`, 303)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  await supabase.auth.signOut()
  // [login-debug] instrumentacao TEMPORARIA (GRUPO A) - remover apos o diagnostico.
  console.log(
    '[login-debug] /sair',
    JSON.stringify({
      cookiesSbAntes: cookieStore
        .getAll()
        .filter((c) => c.name.startsWith('sb-'))
        .map((c) => c.name),
      cookiesSbNaResposta: response.cookies
        .getAll()
        .filter((c) => c.name.startsWith('sb-'))
        .map((c) => ({ name: c.name, vazio: !c.value })),
      redirect: `${origin}/`,
    })
  )
  return response
}
