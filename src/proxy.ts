import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROTAS_AUTH = ['/entrar', '/cadastro', '/recuperar-senha']
const ROTAS_PROTEGIDAS = ['/painel', '/minha-conta']

export default async function proxy(request: NextRequest) {
  // supabaseResponse comeca como NextResponse.next({ request }) e so' e'
  // reatribuida dentro do setAll, quando getUser() de fato renova o
  // token (setAll so' e' chamado pelo @supabase/ssr quando ha mudanca
  // real de cookie - evento TOKEN_REFRESHED na pratica, ja que o proxy
  // nunca faz signIn/signOut). Reescrever com `request` atualizado faz
  // o cookie novo chegar tanto na resposta ao navegador quanto no
  // proprio request encaminhado pra frente, entao Server Components
  // desta mesma navegacao (painel/layout.tsx etc.) ja leem o token
  // fresco em vez de tentar renovar de novo (e descartar, por rodarem
  // em contexto read-only - ver server.ts).
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              path: '/',
            })
          )
          // Log leve, so' dispara quando ha renovacao de verdade (nao a
          // cada request) - pendencia registrada em ESCOPO_PROJETO.md
          // §2 levou dias pra diagnosticar por falta de visibilidade;
          // isso da rastro imediato no log da Vercel se algo quebrar.
          console.log('[proxy] sessao renovada, cookies persistidos:', cookiesToSet.map((c) => c.name).join(', '))
        },
      },
    }
  )

  // IMPORTANTE: nao inserir codigo entre createServerClient e getUser -
  // e' a chamada que dispara o refresh (getUser() renova sozinho se
  // faltar menos de 90s pra expirar, independente de autoRefreshToken).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (user && ROTAS_AUTH.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    const redir = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) => redir.cookies.set(c.name, c.value, c))
    return redir
  }

  if (!user && ROTAS_PROTEGIDAS.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('proximo', pathname)
    const redir = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) => redir.cookies.set(c.name, c.value, c))
    return redir
  }

  // CRITICO: sempre devolver supabaseResponse (carrega os cookies
  // renovados) - nunca um NextResponse.next() novo aqui embaixo.
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
