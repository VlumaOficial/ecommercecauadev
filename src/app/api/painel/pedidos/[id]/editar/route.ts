import { NextResponse, type NextRequest, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { notificarPedido } from '@/lib/notificacoes/notificar-pedido'

// "Editar" (REGRAS_DE_NEGOCIO.md §15.4) - so' reduzir/remover, nunca
// aumentar/adicionar. A validacao de "nunca aumentar" e "so itens ja
// existentes" e' garantida pela RPC ajustar_itens_pedido (migration
// 039), nao aqui - este schema so' confere a FORMA do payload.
const schema = z.object({
  itens: z
    .array(
      z.object({
        variant_id: z.string().uuid(),
        quantidade: z.number().int().positive(),
      })
    )
    .min(1, 'Não é possível remover todos os itens — cancele o pedido em vez disso.'),
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
  const { data, error } = await supabase.rpc('ajustar_itens_pedido', {
    p_order_id: id,
    p_itens: parsed.data.itens,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  after(() =>
    notificarPedido(perfil.tenant_id, id, 'pedido_ajustado').catch((e) =>
      console.error('[notificacoes] falha inesperada ao notificar ajuste:', e)
    )
  )

  return NextResponse.json({ data })
}
