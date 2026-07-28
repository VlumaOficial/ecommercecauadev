import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, senha } = await request.json()
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              path: '/',
            })
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password: String(senha),
  })

  if (error) {
    const msg = error.message.includes('Invalid login credentials')
      ? 'E-mail ou senha incorretos.'
      : error.message.includes('Email not confirmed')
      ? 'E-mail ainda nao confirmado. Verifique sua caixa de entrada.'
      : 'Nao foi possivel entrar. Tente novamente.'
    return NextResponse.json({ ok: false, erro: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
