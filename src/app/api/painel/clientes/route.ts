import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Listagem de clientes (Fase 3, incremento 1). Leitura direta via client
// SERVIDOR + RLS (customers_select_own, migration 013, ja cobre staff do
// tenant apesar do nome) - sem RPC nova, mesmo padrao de GET /api/painel/
// pedidos e /api/painel/cidades.
export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'ativos'
  const busca = searchParams.get('busca')?.trim() ?? ''
  const cidade = searchParams.get('cidade')?.trim() ?? ''

  const supabase = await createClient()
  let query = supabase
    .from('customers')
    .select('id, nome, email, whatsapp, ativo, delivery_city_id, delivery_cities(nome, uf)')
    .order('nome', { ascending: true })

  if (status === 'ativos') query = query.eq('ativo', true)
  else if (status === 'inativos') query = query.eq('ativo', false)

  if (busca) query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%,whatsapp.ilike.%${busca}%`)

  if (cidade === 'sem_cidade') query = query.is('delivery_city_id', null)
  else if (cidade) query = query.eq('delivery_city_id', cidade)

  const { data: clientes, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Não foi possível carregar os clientes.' }, { status: 400 })
  }

  // Nº de pedidos por cliente (só confirmado+concluido - mesmo criterio
  // das metricas da ficha): UMA query agregada, so' dos clientes que a
  // listagem devolveu (se um dia paginar, agrega so' a pagina - nunca
  // 1 query por cliente).
  const ids = (clientes ?? []).map((c) => c.id)
  const contagemPorCliente = new Map<string, number>()
  if (ids.length > 0) {
    const { data: pedidos } = await supabase
      .from('orders')
      .select('customer_id')
      .in('customer_id', ids)
      .in('status', ['confirmado', 'concluido'])
    for (const p of pedidos ?? []) {
      contagemPorCliente.set(p.customer_id, (contagemPorCliente.get(p.customer_id) ?? 0) + 1)
    }
  }

  const data = (clientes ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    email: c.email,
    whatsapp: c.whatsapp,
    ativo: c.ativo,
    cidade_nome: c.delivery_cities?.nome ?? null,
    cidade_uf: c.delivery_cities?.uf ?? null,
    numero_pedidos: contagemPorCliente.get(c.id) ?? 0,
  }))

  return NextResponse.json({ data })
}
