import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Copia o rascunho pros campos publicados (publicar_vitrine, migration
// 031) e limpa o rascunho - atomico, falha (e nao muda nada) se
// alguma CHECK constraint dos campos publicados rejeitar o dado, ou
// se nao houver rascunho pendente.
export async function POST() {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('publicar_vitrine')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
