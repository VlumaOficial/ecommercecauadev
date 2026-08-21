import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Escrita via RPC + client SERVIDOR (mesma licao do checkout/nova-senha:
// sessao httpOnly nao e visivel ao client do navegador). validar_pedido
// (migration 039) baixa estoque real e ja confere permissao/status
// sozinha - esta rota so' valida forma do payload e repassa a mensagem
// de erro em portugues que a RPC ja devolve (REGRAS_DE_NEGOCIO.md §9).
const schema = z.object({
  data_prevista: z
    .union([z.string().trim().min(1), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('validar_pedido', {
    p_order_id: id,
    p_data_prevista: parsed.data.data_prevista,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
