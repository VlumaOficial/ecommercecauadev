import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Reenvia o link de "definir senha" - mesmo mecanismo de recuperação
// de senha do passo 3 da criação (POST /api/painel/equipe), útil se o
// primeiro e-mail se perdeu/expirou/caiu no spam.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  if (perfil.role !== 'admin') {
    return NextResponse.json({ error: 'Só administradores podem reenviar o link de senha.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: membro, error: erroBusca } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', id)
    .single()

  if (erroBusca || !membro) {
    return NextResponse.json({ error: 'Membro da equipe não encontrado.' }, { status: 404 })
  }

  const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const origin = new URL(request.url).origin
  const { error: erroEmail } = await anon.auth.resetPasswordForEmail(membro.email, {
    redirectTo: `${origin}/auth/callback?next=/nova-senha`,
  })

  if (erroEmail) {
    return NextResponse.json({ error: 'Não foi possível reenviar o link agora.' }, { status: 400 })
  }

  return NextResponse.json({ data: { ok: true } })
}
