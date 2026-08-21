import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCustomerProfile } from '@/lib/auth'

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

  return NextResponse.json({ data }, { status: 201 })
}
