import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get('email') || '')
  const senha = String(formData.get('senha') || '')
  const proximo = String(formData.get('proximo') || '/')
  const origin = new URL(request.url).origin

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  })

  if (error) {
    const msg = error.message.includes('Invalid login credentials')
      ? 'E-mail ou senha incorretos.'
      : error.message.includes('Email not confirmed')
      ? 'E-mail ainda nao confirmado.'
      : 'Nao foi possivel entrar.'
    return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent(msg)}`, 303)
  }

  // 303 See Other: cookie (Set-Cookie) + redirect na MESMA resposta = atomico
  return NextResponse.redirect(`${origin}${proximo}`, 303)
}
