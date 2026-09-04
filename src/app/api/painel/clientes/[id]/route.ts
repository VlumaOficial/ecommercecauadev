import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
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
    .select('id, nome, email, whatsapp, ativo, created_at, delivery_city_id, observacoes, delivery_cities(nome, uf)')
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
      delivery_city_id: cliente.delivery_city_id,
      observacoes: cliente.observacoes,
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

// Editar cliente (Fase 3, incremento 2). E-mail é read-only aqui - é o
// identificador de login (mesmo princípio de PATCH /api/loja/conta e
// PATCH /api/painel/equipe/[id], nenhum dos dois deixa editar e-mail).
const clienteUpdateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  whatsapp: z.string().trim().refine((v) => {
    const d = v.replace(/\D/g, '')
    return d.length === 10 || d.length === 11
  }, 'Informe um WhatsApp válido com DDD.'),
  delivery_city_id: z.string().uuid().nullable(),
  observacoes: z.string().trim().nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  // Qualquer staff do tenant pode gerenciar clientes (decisão do PO,
  // Fase 3 Inc 2, 04/09/2026).

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = clienteUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()
  if (parsed.data.delivery_city_id) {
    const { data: cidadeOk } = await supabase
      .from('delivery_cities')
      .select('id')
      .eq('id', parsed.data.delivery_city_id)
      .eq('tenant_id', perfil.tenant_id)
      .eq('ativo', true)
      .maybeSingle()
    if (!cidadeOk) {
      return NextResponse.json({ error: 'Cidade de entrega não encontrada.' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('customers')
    .update({
      nome: parsed.data.nome,
      whatsapp: parsed.data.whatsapp.replace(/\D/g, ''),
      delivery_city_id: parsed.data.delivery_city_id,
      observacoes: parsed.data.observacoes || null,
    })
    .eq('id', id)
    .select('id, nome, email, whatsapp, ativo, delivery_city_id, observacoes')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Não foi possível salvar o cliente.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}
