import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Troca a capa via RPC (definir_imagem_principal, migration 023) -
// atomica no banco, evita violar o indice unico parcial de "principal"
// no meio do caminho (a RPC ja recusa imagem de variacao com mensagem
// amigavel, nao precisa validar isso aqui de novo).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { imageId } = await params
  const supabase = await createClient()

  const { error } = await supabase.rpc('definir_imagem_principal', { p_image_id: imageId })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
