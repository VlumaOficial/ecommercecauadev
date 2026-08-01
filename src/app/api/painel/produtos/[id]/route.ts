import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const ativoOnlySchema = z.object({ ativo: z.boolean() })

// Por enquanto so o toggle rapido de ativo/inativo (nao depende da RPC
// atualizar_produto_com_variacoes - migration 017, ainda nao aplicada).
// Edicao completa (dados + variacoes) chega junto com a 017.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = ativoOnlySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Edição completa do produto ainda não está disponível — em breve.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .update({ ativo: parsed.data.ativo })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Não foi possível atualizar o status do produto.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}
