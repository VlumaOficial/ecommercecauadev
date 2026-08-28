import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getStaffProfileForUser } from '@/lib/auth'
import type { Database } from '@/types/database'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get('email') || '')
  const senha = String(formData.get('senha') || '')
  const proximo = String(formData.get('proximo') || '/')
  const origin = new URL(request.url).origin

  const cookieStore = await cookies()

  // Response criado ANTES do signIn: setAll grava direto nele, garantindo
  // que o Set-Cookie va junto no redirect retornado (cookieStore.set() sozinho
  // nao propaga para um NextResponse.redirect() construido separadamente).
  const response = NextResponse.redirect(`${origin}${proximo}`, 303)

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  })

  // [login-debug] instrumentacao TEMPORARIA (GRUPO A) - Function Logs do
  // Vercel, filtrar por "[login-debug]". Remover apos o diagnostico.
  console.log(
    '[login-debug] api/auth/login',
    JSON.stringify({
      email: email.trim(),
      proximo,
      sucesso: !error && !!data.user,
      erro: error?.message ?? null,
      userId: data.user?.id ?? null,
      cookiesSbSetadosNaResposta: response.cookies
        .getAll()
        .filter((c) => c.name.startsWith('sb-'))
        .map((c) => ({ name: c.name, vazio: !c.value })),
    })
  )

  if (error) {
    const msg = error.message.includes('Invalid login credentials')
      ? 'E-mail ou senha incorretos.'
      : error.message.includes('Email not confirmed')
      ? 'E-mail ainda nao confirmado.'
      : 'Nao foi possivel entrar.'
    // Mesma response (preserva quaisquer cookies ja gravados pelo setAll),
    // so troca o destino do redirect.
    response.headers.set('Location', `${origin}/entrar?erro=${encodeURIComponent(msg)}`)
    console.log('[login-debug] api/auth/login FALHOU, redirect ->', response.headers.get('Location'))
    return response
  }

  // proximo === '/' significa "sem destino explicito" (valor default do form
  // quando nao ha ?proximo= na URL de /entrar). Nesse caso, staff vai pro
  // painel; cliente comum continua indo pra vitrine. Um proximo explicito
  // (ex.: usuario redirecionado de uma rota protegida) sempre e respeitado.
  if (proximo === '/' && data.user) {
    const staff = await getStaffProfileForUser(supabase, data.user.id)
    if (staff) {
      response.headers.set('Location', `${origin}/painel`)
    }
  }

  // 303 See Other: cookie (Set-Cookie) + redirect na MESMA resposta = atomico
  console.log('[login-debug] api/auth/login OK, redirect ->', response.headers.get('Location'))
  return response
}
