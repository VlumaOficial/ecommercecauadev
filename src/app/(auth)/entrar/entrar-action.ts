'use server'

import { createClient } from '@/lib/supabase/server'

export type ResultadoLogin = { ok: true; debug: string } | { ok: false; erro: string; debug: string }

export async function entrarAction(email: string, senha: string): Promise<ResultadoLogin> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  })

  const debug = JSON.stringify({
    temSessao: !!data?.session,
    temUser: !!data?.user,
    userEmail: data?.user?.email ?? null,
    erro: error?.message ?? null,
    erroStatus: (error as { status?: number } | null)?.status ?? null,
  })

  if (error) {
    return { ok: false, erro: error.message, debug }
  }
  return { ok: true, debug }
}
