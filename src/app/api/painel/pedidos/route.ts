import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import type { Database } from '@/types/database'

type OrderStatus = Database['public']['Enums']['order_status']
const STATUSES: OrderStatus[] = ['aguardando_validacao', 'confirmado', 'concluido', 'cancelado']

// Leitura direta via client SERVIDOR + RLS (orders_select_staff,
// migration 037: is_staff() e tenant_id=current_tenant_id()) - mesmo
// padrao ja usado em GET /api/painel/produtos, sem RPC nenhuma pra
// listar (RPCs so entram nas escritas de validar/editar/cancelar/
// concluir, migration 039).
export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'aguardando_validacao'

  const supabase = await createClient()
  let query = supabase
    .from('orders')
    .select('id, numero, status, total, created_at, customers(nome), delivery_cities(nome, uf)')
    .order('created_at', { ascending: false })

  if ((STATUSES as string[]).includes(status)) {
    query = query.eq('status', status as OrderStatus)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Não foi possível carregar os pedidos. Tente novamente.' }, { status: 400 })
  }

  const pedidos = (data ?? []).map((p) => ({
    id: p.id,
    numero: p.numero,
    status: p.status,
    total: p.total,
    created_at: p.created_at,
    cliente_nome: p.customers?.nome ?? '—',
    cidade_nome: p.delivery_cities?.nome ?? null,
    cidade_uf: p.delivery_cities?.uf ?? null,
  }))

  return NextResponse.json({ data: pedidos })
}
