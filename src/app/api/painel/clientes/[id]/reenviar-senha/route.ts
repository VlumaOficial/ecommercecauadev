import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Fase 3, incremento 2. Mesmo mecanismo de POST /api/painel/equipe/[id]/
// reenviar-senha (resetPasswordForEmail), só troca profiles por customers.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: cliente, error: erroBusca } = await supabase
    .from('customers')
    .select('email')
    .eq('id', id)
    .single()

  if (erroBusca || !cliente?.email) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const origin = new URL(request.url).origin
  const { error: erroEmail } = await anon.auth.resetPasswordForEmail(cliente.email, {
    redirectTo: `${origin}/auth/callback?next=/nova-senha`,
  })

  if (erroEmail) {
    return NextResponse.json({ error: 'Não foi possível reenviar o link agora.' }, { status: 400 })
  }

  return NextResponse.json({ data: { ok: true } })
}
