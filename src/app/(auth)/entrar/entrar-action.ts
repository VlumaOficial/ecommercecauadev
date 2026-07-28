'use server'

import { createClient } from '@/lib/supabase/server'

export type ResultadoLogin = { ok: true } | { ok: false; erro: string }

export async function entrarAction(email: string, senha: string): Promise<ResultadoLogin> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  })

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      return { ok: false, erro: 'E-mail ainda nao confirmado. Verifique sua caixa de entrada.' }
    }
    if (error.message.includes('Invalid login credentials')) {
      return { ok: false, erro: 'E-mail ou senha incorretos.' }
    }
    return { ok: false, erro: 'Nao foi possivel entrar. Tente novamente.' }
  }
  return { ok: true }
}
