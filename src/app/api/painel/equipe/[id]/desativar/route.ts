import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  if (perfil.role !== 'admin') {
    return NextResponse.json({ error: 'Só administradores podem desativar membros da equipe.' }, { status: 403 })
  }

  const { id } = await params

  // Autoproteção: um admin não pode desativar a própria conta (evita
  // se trancar fora sozinho) - decisão do PO, item 3 da sequência
  // (24/08/2026).
  if (id === perfil.id) {
    return NextResponse.json({ error: 'Você não pode desativar sua própria conta.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ ativo: false })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
