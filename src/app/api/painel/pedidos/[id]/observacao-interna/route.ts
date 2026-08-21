import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Grava a anotacao interna do vendedor sobre o pedido (RPC
// atualizar_observacao_interna_pedido, migration 040 - a 039 nao tinha
// nenhuma RPC de escrita pra este campo, so' a coluna). O cliente
// nunca ve este campo (REGRAS_DE_NEGOCIO.md §19.3/§20) - nem esta rota
// nem a RPC sao chamadas em nenhuma tela da vitrine/area do cliente.
const schema = z.object({
  observacao: z.string().trim().max(2000).optional().default(''),
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
  const { data, error } = await supabase.rpc('atualizar_observacao_interna_pedido', {
    p_order_id: id,
    p_observacao: parsed.data.observacao || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
