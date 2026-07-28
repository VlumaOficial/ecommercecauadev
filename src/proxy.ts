import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROTAS_AUTH = ['/entrar', '/cadastro', '/recuperar-senha']
const ROTAS_PROTEGIDAS = ['/painel', '/minha-conta']

export default async function proxy(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: nao inserir codigo entre createServerClient e getUser
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Logado em rota de auth -> home
  if (user && ROTAS_AUTH.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    const redir = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) =>
      redir.cookies.set(c.name, c.value, c)
    )
    return redir
  }

  // Deslogado em rota protegida -> login
  if (!user && ROTAS_PROTEGIDAS.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('proximo', pathname)
    const redir = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) =>
      redir.cookies.set(c.name, c.value, c)
    )
    return redir
  }

  // CRITICO: sempre retornar supabaseResponse (com os cookies) intacto
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
