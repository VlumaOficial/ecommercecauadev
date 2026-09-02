import { NextResponse, type NextRequest, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { notificarPedido } from '@/lib/notificacoes/notificar-pedido'

// Marca a entrega como realizada (confirmado -> concluido, grava
// data_efetiva=now() dentro da RPC concluir_pedido, migration 039).
// Sem payload - nada a validar alem da sessao/permissao.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('concluir_pedido', { p_order_id: id })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Incremento 3/4 (notificações ao cliente): avisa o cliente que o
  // pedido foi entregue. Mesmo molde do incremento 1 - after() roda
  // depois da resposta ao vendedor (nao a atrasa nem a quebra),
  // .catch() proprio, best-effort. Destinatario = cliente do pedido,
  // resolvido dentro de notificarPedido; guard de WhatsApp vazio ja
  // vive la.
  after(() =>
    notificarPedido(perfil.tenant_id, id, 'pedido_entregue').catch((e) =>
      console.error('[notificacoes] falha inesperada ao notificar entrega:', e)
    )
  )

  return NextResponse.json({ data })
}
