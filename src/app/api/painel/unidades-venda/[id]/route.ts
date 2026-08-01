import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const unidadeUpdateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da unidade.'),
  ativo: z.boolean(),
})

const ativoOnlySchema = z.object({ ativo: z.boolean() })

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
  const supabase = await createClient()

  // Toggle rapido de status: payload so com { ativo }
  if (body && Object.keys(body).length === 1 && ativoOnlySchema.safeParse(body).success) {
    const { data, error } = await supabase
      .from('unidades_venda')
      .update({ ativo: body.ativo })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  const parsed = unidadeUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados invalidos.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('unidades_venda')
    .update({ nome: parsed.data.nome, ativo: parsed.data.ativo })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const message = error.code === '23505' ? 'Já existe uma unidade de venda com esse nome.' : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
