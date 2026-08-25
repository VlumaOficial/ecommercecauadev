import { randomBytes } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffProfile } from '@/lib/auth'

// Fase 2, item 3 da sequência pré-incremento 8 (gestão de usuários) -
// consome pela primeira vez o fluxo de 2 passos que corrigiu o bug 46
// (ESCOPO_PROJETO.md §2/§0 item 49): criar staff é SEMPRE
// admin.createUser() sem `role` nenhum (cai em customers, previsível,
// sem corrida) + a RPC promover_para_staff (service role) fazendo a
// transição. Nunca "uma chamada só" - é exatamente esse caminho que
// causava o bug.
const staffCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  role: z.enum(['admin', 'operador']),
  pode_aceitar_pedido: z.boolean().optional().default(false),
})

export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'ativos'

  const supabase = await createClient()
  let query = supabase.from('profiles').select('*').order('nome', { ascending: true })

  if (status === 'ativos') query = query.eq('ativo', true)
  else if (status === 'inativos') query = query.eq('ativo', false)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data, meuId: perfil.id })
}

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  // Provisionar staff é ação de admin - diferente de `pode_gerenciar`
  // (que é sobre gerenciar PEDIDOS, não sobre gerenciar A EQUIPE).
  if (perfil.role !== 'admin') {
    return NextResponse.json({ error: 'Só administradores podem adicionar membros da equipe.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = staffCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Passo 1: cria o usuário auth SEM nenhum `role` em app_metadata - cai
  // em `customers` de forma previsível (mesmo caminho de qualquer
  // signup real), sem depender de nenhum timing do GoTrue. Senha
  // aleatória que ninguém vê/loga - o funcionário nunca a aprende, ele
  // define a própria via o link de "definir senha" (passo 3).
  const senhaAleatoria = randomBytes(24).toString('base64url')
  const { data: novoUsuario, error: erroCriar } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: senhaAleatoria,
    email_confirm: true,
  })
  if (erroCriar || !novoUsuario.user) {
    const message = erroCriar?.message?.includes('already been registered')
      ? 'Já existe uma conta com esse e-mail.'
      : 'Não foi possível criar a conta.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Passo 2: promove a staff - RPC service-role-only (migration 041).
  const { data: perfilCriado, error: erroPromover } = await admin.rpc('promover_para_staff', {
    p_auth_user_id: novoUsuario.user.id,
    p_nome: parsed.data.nome,
    p_role: parsed.data.role,
    p_pode_aceitar_pedido: parsed.data.pode_aceitar_pedido,
  })
  if (erroPromover) {
    // A conta auth já existe (passo 1) mas ficou como customer comum -
    // não desfazemos automaticamente (apagar usuário auth tem efeito
    // colateral próprio); o erro é claro e quem provisiona pode tentar
    // de novo com o mesmo e-mail assim que resolver o motivo.
    return NextResponse.json({ error: erroPromover.message }, { status: 400 })
  }

  // Passo 3: dispara o e-mail de "definir senha" - reaproveita 100% o
  // mecanismo de recuperação de senha já testado com link real
  // (REGRAS_DE_NEGOCIO.md §18.4), não um convite novo. Falha aqui NÃO
  // desfaz a criação (a conta/perfil já existem de verdade) - só avisa
  // na resposta, a tela pode oferecer "reenviar" depois.
  const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const origin = new URL(request.url).origin
  const { error: erroEmail } = await anon.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/nova-senha`,
  })

  return NextResponse.json({ data: perfilCriado, emailEnviado: !erroEmail }, { status: 201 })
}
