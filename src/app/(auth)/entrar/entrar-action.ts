'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function entrarAction(formData: FormData) {
  const email = String(formData.get('email') || '')
  const senha = String(formData.get('senha') || '')
  const proximo = String(formData.get('proximo') || '/')

  const supabase = await createClient()
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
    redirect('/entrar?erro=' + encodeURIComponent(msg))
  }

  redirect(proximo)
}
