import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROTAS_AUTH = ['/entrar', '/cadastro', '/recuperar-senha']
const ROTAS_PROTEGIDAS = ['/painel', '/minha-conta']

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Client somente-leitura: NUNCA grava cookies (evita sobrescrever a sessao)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // intencionalmente vazio: proxy nao renova nem grava cookies
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && ROTAS_AUTH.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (!user && ROTAS_PROTEGIDAS.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('proximo', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
