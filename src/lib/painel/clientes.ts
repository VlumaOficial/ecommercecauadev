import 'server-only'
import { randomBytes } from 'crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Tables } from '@/types/database'

type ClienteRow = Pick<
  Tables<'customers'>,
  'id' | 'nome' | 'email' | 'whatsapp' | 'ativo' | 'delivery_city_id' | 'observacoes'
>

export type CriarClienteParams = {
  nome: string
  email: string
  // Só dígitos (DDD+número, sem DDI).
  whatsapp: string
  delivery_city_id: string | null
  observacoes: string | null
  // true (Inc 2, criação individual): dispara resetPasswordForEmail.
  // false (Inc 3, importação em massa): pula o disparo por completo -
  // decisão de produto (ESCOPO_PROJETO.md §0 item 55) para não
  // concentrar volume de e-mail no remetente global da VLUMA.
  enviarEmail: boolean
  // Origin da requisição (`new URL(request.url).origin`), usado só para
  // montar o redirectTo do e-mail de senha quando enviarEmail=true.
  origin: string
}

export type CriarClienteResultado =
  | { ok: true; cliente: ClienteRow; emailEnviado: boolean | null }
  | { ok: false; error: string }

// Extraída do Inc 2 (Fase 3) para ser reaproveitada pela importação em
// massa (Inc 3) sem duplicar a lógica de criação. Criar cliente é SEMPRE
// 1 passo só (diferente do staff em /api/painel/equipe, que precisa da
// RPC promover_para_staff): admin.createUser() SEM app_metadata.role cai
// direto em `customers` via handle_new_user (migration 033), na mesma
// transação do INSERT em auth.users - nome/whatsapp/delivery_city_id vêm
// prontos do user_metadata, sem precisar de UPDATE depois (só
// observacoes, que o trigger não conhece).
export async function criarClienteComoStaff(params: CriarClienteParams): Promise<CriarClienteResultado> {
  const admin = createAdminClient()

  // Senha aleatória que ninguém vê/loga - o cliente define a própria via
  // o e-mail de "definir senha" (quando enviarEmail=true) ou via
  // "Reenviar senha"/"esqueci minha senha" depois (quando não).
  const senhaAleatoria = randomBytes(24).toString('base64url')
  const { data: novoUsuario, error: erroCriar } = await admin.auth.admin.createUser({
    email: params.email,
    password: senhaAleatoria,
    email_confirm: true,
    user_metadata: {
      nome: params.nome,
      whatsapp: params.whatsapp,
      delivery_city_id: params.delivery_city_id ?? '',
    },
  })
  if (erroCriar || !novoUsuario.user) {
    const message = erroCriar?.message?.includes('already been registered')
      ? 'Já existe uma conta com esse e-mail.'
      : 'Não foi possível criar a conta.'
    return { ok: false, error: message }
  }

  // handle_new_user roda na mesma transação do INSERT em auth.users - a
  // linha em customers já existe aqui, sem corrida/retry.
  const { data: clienteCriado, error: erroBusca } = await admin
    .from('customers')
    .select('id, nome, email, whatsapp, ativo, delivery_city_id, observacoes')
    .eq('auth_user_id', novoUsuario.user.id)
    .maybeSingle()

  if (erroBusca || !clienteCriado) {
    return { ok: false, error: 'A conta foi criada, mas não foi possível confirmar o cadastro do cliente.' }
  }

  // observacoes não faz parte do metadata do trigger (só nome/whatsapp/
  // delivery_city_id) - UPDATE simples à parte, mesmo padrão do whatsapp
  // de staff em POST /api/painel/equipe. Falha aqui não desfaz a criação.
  let clienteFinal: ClienteRow = clienteCriado
  if (params.observacoes) {
    const { data: clienteComObs } = await admin
      .from('customers')
      .update({ observacoes: params.observacoes })
      .eq('id', clienteCriado.id)
      .select('id, nome, email, whatsapp, ativo, delivery_city_id, observacoes')
      .single()
    if (clienteComObs) clienteFinal = clienteComObs
  }

  // emailEnviado null = nem tentado (importação em massa) - distinto de
  // `false` (tentou e o provedor recusou), pra o log nunca confundir os
  // dois casos.
  let emailEnviado: boolean | null = null
  if (params.enviarEmail) {
    // Dispara o e-mail de "definir senha" - reaproveita 100% o mecanismo
    // já testado (REGRAS_DE_NEGOCIO.md §18.4), sem template novo. Falha
    // aqui NÃO desfaz a criação - a tela oferece "reenviar" depois.
    const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error: erroEmail } = await anon.auth.resetPasswordForEmail(params.email, {
      redirectTo: `${params.origin}/auth/callback?next=/nova-senha`,
    })
    emailEnviado = !erroEmail
  }

  return { ok: true, cliente: clienteFinal, emailEnviado }
}
