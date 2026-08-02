import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Historico de uma variacao especifica. usuario_id nulo (movimentacao
// gerada pelo sistema, ex.: backfill da migration 021) vira "Sistema"
// na resposta - nunca inventamos um responsavel que nao existe.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { variantId } = await params
  const supabase = await createClient()

  const { data: movimentos, error } = await supabase
    .from('stock_movements')
    .select('id, tipo, quantidade, saldo_anterior, saldo_novo, motivo, usuario_id, created_at')
    .eq('variant_id', variantId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Não foi possível carregar o histórico. Tente novamente.' }, { status: 400 })
  }

  const usuarioIds = [...new Set((movimentos ?? []).flatMap((m) => (m.usuario_id ? [m.usuario_id] : [])))]
  let nomePorUsuarioId = new Map<string, string>()

  if (usuarioIds.length > 0) {
    const { data: perfis } = await supabase.from('profiles').select('id, nome').in('id', usuarioIds)
    nomePorUsuarioId = new Map((perfis ?? []).map((p) => [p.id, p.nome]))
  }

  const data = (movimentos ?? []).map((m) => ({
    ...m,
    usuario_nome: m.usuario_id ? (nomePorUsuarioId.get(m.usuario_id) ?? '—') : 'Sistema',
  }))

  return NextResponse.json({ data })
}
