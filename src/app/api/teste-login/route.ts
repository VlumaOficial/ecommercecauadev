import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, senha } = await request.json()
  const cookieStore = await cookies()
  const cookiesGravados: string[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
            cookiesGravados.push(name)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password: String(senha),
  })

  return NextResponse.json({
    temSessao: !!data?.session,
    erro: error?.message ?? null,
    cookiesGravados,
  })
}
