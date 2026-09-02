import { NextResponse, type NextRequest, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCustomerProfile } from '@/lib/auth'
import { notificarPedidoNovoParaLojista } from '@/lib/notificacoes/notificar-lojista'
import { notificarPedido } from '@/lib/notificacoes/notificar-pedido'

// O after() (aviso de pedido novo ao lojista, §18.6c) roda DEPOIS da
// resposta, mas ainda dentro do tempo de vida da funcao. O default do
// plano (10-15s) e' curto pro DB + handshake SMTP do Zoho: a funcao era
// terminada com o e-mail no meio do envio, sem log. 30s da' folga.
export const maxDuration = 30

// Fase 2, incremento 5 (Checkout). RPC criar_pedido (migration 037) so'
// resolve auth.uid() de verdade quando chamada com o client SERVIDOR (le
// os cookies httpOnly da sessao via cookies() do Next) - o client do
// NAVEGADOR (createBrowserClient, sem cookies() nenhum) nunca chega a ver
// a sessao criada por /api/auth/login (cookies httpOnly de proposito, nao
// legiveis por document.cookie), entao um supabase.rpc() direto do client
// sempre falharia com "Não foi possível identificar sua conta" mesmo com
// o cliente logado de verdade - achado testando com Chromium real contra
// a URL publica, corrigido movendo a chamada pra ca.
const checkoutSchema = z.object({
  delivery_city_id: z.string().uuid('Selecione a cidade de entrega.'),
  observacao_cliente: z.string().trim().max(1000).optional().nullable(),
  itens: z
    .array(
      z.object({
        variant_id: z.string().uuid(),
        quantidade: z.number().int().positive(),
      })
    )
    .min(1, 'Adicione pelo menos um item ao pedido.'),
})

export async function POST(request: NextRequest) {
  const cliente = await getCustomerProfile()
  if (!cliente) {
    return NextResponse.json({ error: 'Você precisa estar logado para finalizar o pedido.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('criar_pedido', {
    p_modalidade_entrega: 'ponto_encontro',
    p_delivery_city_id: parsed.data.delivery_city_id,
    p_observacao_cliente: parsed.data.observacao_cliente || null,
    p_itens: parsed.data.itens,
  })

  if (error) {
    // Mensagem ja vem em portugues claro da RPC (REGRAS_DE_NEGOCIO.md §9)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Dois avisos best-effort, disparados via after() (rodam DEPOIS da
  // resposta ao cliente - nao atrasam nem quebram o checkout se o envio
  // falhar). Sao pipelines SEPARADOS, cada um com seu proprio .catch():
  //
  //  1. LOJISTA (§18.6c): evento 'pedido_novo', destinatario = staff
  //     configurados em order_notification_recipients.
  //  2. CLIENTE (§18.6b, incremento 1 de 4): evento 'pedido_recebido',
  //     destinatario = o proprio cliente do pedido (customers). Nunca
  //     se cruza com (1) - origem de destinatario e evento diferentes.
  //     O guard de "cliente sem WhatsApp" fica dentro de notificarPedido().
  after(() =>
    notificarPedidoNovoParaLojista(cliente.tenant_id, data.id).catch((e) =>
      console.error('[notificacoes] falha inesperada ao avisar lojista de pedido novo:', e)
    )
  )
  after(() =>
    notificarPedido(cliente.tenant_id, data.id, 'pedido_recebido').catch((e) =>
      console.error('[notificacoes] falha inesperada ao avisar cliente de pedido recebido:', e)
    )
  )

  return NextResponse.json({ data }, { status: 201 })
}
