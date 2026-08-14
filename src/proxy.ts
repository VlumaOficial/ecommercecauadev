import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROTAS_AUTH = ['/entrar', '/cadastro', '/recuperar-senha']
// /vitrine-preview fica fora de /painel (nao herda o layout com
// sidebar - precisa renderizar a vitrine de verdade, full-bleed) mas
// e' protegida do mesmo jeito - a pagina em si ja faz o proprio check
// de staff (getStaffProfile()), isto aqui e' so' defesa em
// profundidade (redireciona na borda, antes de renderizar).
const ROTAS_PROTEGIDAS = ['/painel', '/minha-conta', '/vitrine-preview']

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

  // ---------- Resolucao de tenant por host (Vitrine Fase 0) ----------
  // So' roda no caminho de "passa direto" - DEPOIS dos dois redirects
  // de auth acima, nunca antes e nunca dentro deles. Nao redireciona
  // nem bloqueia por causa de tenant: host sem match em
  // tenant_domains so' significa "sem header anexado" - quem decide
  // 404 e' a pagina da Vitrine que ler getTenantFromHeaders()
  // (src/lib/tenant.ts), nunca o proxy. Erro na RPC (rede/banco fora)
  // e' tratado do mesmo jeito - fail-open pra "sem tenant", nunca
  // derruba a requisicao.
  let response = supabaseResponse
  const host = request.headers.get('host')

  if (host) {
    const { data: tenant, error } = await supabase.rpc('resolve_tenant_by_host', { p_host: host })
    const resolvido = Array.isArray(tenant) ? tenant[0] : null

    if (!error && resolvido?.tenant_id && resolvido?.slug) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-tenant-id', resolvido.tenant_id)
      requestHeaders.set('x-tenant-slug', resolvido.slug)
      response = NextResponse.next({ request: { headers: requestHeaders } })
      // Reaplica os cookies que o setAll acima ja tinha preparado
      // (renovacao de sessao) - troquei de objeto de response pra
      // poder anexar os headers de tenant no request encaminhado, mas
      // a renovacao de sessao nao pode se perder nessa troca.
      supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c.name, c.value, c))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
