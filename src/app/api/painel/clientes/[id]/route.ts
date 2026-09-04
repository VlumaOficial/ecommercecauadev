import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Ficha do cliente (Fase 3, incremento 1). Metricas calculadas em cima do
// historico de pedidos do proprio cliente - sem RPC nova, sem view. So'
// pedidos confirmado+concluido entram no total gasto/ticket medio/ultima
// compra (venda de fato comprometida - aguardando_validacao ainda pode
// ser recusado, cancelado nao e' venda). Cancelados aparecem so' como
// contador complementar, fora da media.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: cliente, error } = await supabase
    .from('customers')
    .select('id, nome, email, whatsapp, ativo, created_at, delivery_cities(nome, uf)')
    .eq('id', id)
    .maybeSingle()

  if (error || !cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  const { data: pedidosBrutos, error: errPedidos } = await supabase
    .from('orders')
    .select('id, numero, status, total, created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  if (errPedidos) {
    return NextResponse.json({ error: 'Não foi possível carregar o histórico de pedidos.' }, { status: 400 })
  }

  const pedidos = pedidosBrutos ?? []
  // pedidos ja' vem ordenado desc por created_at - validos preserva a
  // ordem, entao validos[0] e' a compra valida mais recente.
  const validos = pedidos.filter((p) => p.status === 'confirmado' || p.status === 'concluido')
  const totalGasto = validos.reduce((soma, p) => soma + Number(p.total), 0)
  const numeroPedidos = validos.length

  return NextResponse.json({
    data: {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      whatsapp: cliente.whatsapp,
      ativo: cliente.ativo,
      created_at: cliente.created_at,
      cidade: cliente.delivery_cities ?? null,
      metricas: {
        numero_pedidos: numeroPedidos,
        total_gasto: totalGasto,
        ticket_medio: numeroPedidos > 0 ? totalGasto / numeroPedidos : 0,
        ultima_compra: validos[0]?.created_at ?? null,
        pedidos_cancelados: pedidos.filter((p) => p.status === 'cancelado').length,
      },
      pedidos,
    },
  })
}
