import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROTAS_AUTH = ['/entrar', '/cadastro', '/recuperar-senha']
const ROTAS_PROTEGIDAS = ['/painel', '/minha-conta']

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Helper: redireciona preservando os cookies de sessao ja gravados em `response`
  function redirecionarPreservandoCookies(destino: string) {
    const url = request.nextUrl.clone()
    url.pathname = destino
    if (destino === '/entrar') {
      url.searchParams.set('proximo', pathname)
    }
    const redir = NextResponse.redirect(url)
    // CRITICO: copiar cookies de sessao para a resposta de redirecionamento
    response.cookies.getAll().forEach((c) => {
      redir.cookies.set(c.name, c.value, c)
    })
    return redir
  }

  if (user && ROTAS_AUTH.some((r) => pathname.startsWith(r))) {
    return redirecionarPreservandoCookies('/')
  }

  if (!user && ROTAS_PROTEGIDAS.some((r) => pathname.startsWith(r))) {
    return redirecionarPreservandoCookies('/entrar')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
