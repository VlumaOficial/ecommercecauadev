import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Cancelamento manual (REGRAS_DE_NEGOCIO.md §17.1) - motivo obrigatorio
// (a RPC cancelar_pedido, migration 039, ja recusa sem motivo; validado
// aqui tambem so' pra dar feedback imediato no formulario).
const schema = z.object({
  motivo: z.string().trim().min(1, 'Informe o motivo do cancelamento.'),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cancelar_pedido', {
    p_order_id: id,
    p_motivo: parsed.data.motivo,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
