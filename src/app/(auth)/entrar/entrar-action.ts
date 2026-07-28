'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export type ResultadoLogin = { ok: boolean; erro?: string; debug: string }

export async function entrarAction(email: string, senha: string): Promise<ResultadoLogin> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  })

  if (error) {
    return { ok: false, erro: error.message, debug: 'erro auth: ' + error.message }
  }

  // Inspecionar cookies APOS o signIn, dentro da propria action
  const jar = await cookies()
  const todos = jar.getAll().map((c) => c.name)
  const temSbCookie = todos.some((n) => n.startsWith('sb-'))

  const debug = JSON.stringify({
    temSessao: !!data?.session,
    cookiesNaAction: todos,
    temSbCookie,
  })

  return { ok: true, debug }
}
