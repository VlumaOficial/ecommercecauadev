import { NextResponse, type NextRequest, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { notificarPedido } from '@/lib/notificacoes/notificar-pedido'

// Remarcar a data de entrega de um pedido ja validado (ou ainda
// aguardando validacao) - feature "modificacao de pedido pelo
// vendedor", incremento B. A RPC remarcar_entrega_pedido (migration
// 051) valida status/permissao/motivo/data (nao no passado, tem que
// mudar), grava a linha em order_delivery_reschedules e atualiza
// orders.data_prevista, tudo na mesma transacao. Esta rota so' confere
// a FORMA do payload e repassa a mensagem de erro em portugues da RPC
// (REGRAS_DE_NEGOCIO.md §9). O motivo e' INTERNO - nao vai pro cliente.
const schema = z.object({
  data_nova: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data de entrega válida.'),
  motivo: z.string().trim().min(1, 'Informe o motivo da remarcação.'),
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('remarcar_entrega_pedido', {
    p_order_id: id,
    p_data_nova: parsed.data.data_nova,
    p_motivo: parsed.data.motivo,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // A RPC ja atualizou orders.data_prevista - o {data_prevista} do
  // template de pedido_data_remarcada sai com a NOVA data. after() roda
  // pos-resposta ao vendedor, .catch() proprio, best-effort.
  after(() =>
    notificarPedido(perfil.tenant_id, id, 'pedido_data_remarcada').catch((e) =>
      console.error('[notificacoes] falha inesperada ao notificar remarcacao de entrega:', e)
    )
  )

  return NextResponse.json({ data })
}
