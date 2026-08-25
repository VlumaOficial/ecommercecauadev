import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const staffUpdateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  role: z.enum(['admin', 'operador']),
  pode_aceitar_pedido: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  if (perfil.role !== 'admin') {
    return NextResponse.json({ error: 'Só administradores podem editar a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = staffUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  }

  // Autoproteção: ninguém troca o próprio papel por aqui (evita um
  // admin se trancar fora sozinho, rebaixando-se sem querer) - decisão
  // do PO, item 3 da sequência (24/08/2026).
  if (id === perfil.id && parsed.data.role !== perfil.role) {
    return NextResponse.json({ error: 'Você não pode alterar seu próprio papel.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({
      nome: parsed.data.nome,
      role: parsed.data.role,
      pode_aceitar_pedido: parsed.data.pode_aceitar_pedido,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
