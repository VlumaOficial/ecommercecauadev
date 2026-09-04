import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Fase 3, incremento 2. Diferente de /api/painel/equipe/[id]/desativar,
// sem autoproteção (cliente nunca é a própria sessão de staff) e sem
// gate admin-only (decisão do PO - qualquer staff do tenant gerencia
// clientes). Cliente inativo já é bloqueado na camada de app
// (getCustomerProfile filtra ativo=true) - login em si não é tocado.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .update({ ativo: false })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Não foi possível desativar o cliente.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}
