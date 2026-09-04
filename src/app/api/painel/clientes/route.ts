import { randomBytes } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
    .select('id, nome, email, whatsapp, ativo, delivery_city_id, observacoes, delivery_cities(nome, uf)')
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
    delivery_city_id: c.delivery_city_id,
    observacoes: c.observacoes,
    cidade_nome: c.delivery_cities?.nome ?? null,
    cidade_uf: c.delivery_cities?.uf ?? null,
    numero_pedidos: contagemPorCliente.get(c.id) ?? 0,
  }))

  return NextResponse.json({ data })
}

// Fase 3, incremento 2 (aprovado pelo PO em 04/09/2026). Criar cliente é
// SEMPRE 1 passo só (diferente do staff em /api/painel/equipe, que precisa
// da RPC promover_para_staff): admin.createUser() SEM app_metadata.role
// cai direto em `customers` via handle_new_user (migration 033), na mesma
// transação do INSERT em auth.users - nome/whatsapp/delivery_city_id vêm
// prontos do user_metadata, sem precisar de UPDATE depois (só observacoes,
// que o trigger não conhece).
const clienteCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  // Obrigatório para cliente (diferente de staff) - mesma exigência já
  // aplicada no cadastro público (cadastro-form.tsx) e na Área do Cliente
  // (conta-form.tsx/PATCH /api/loja/conta): DDD + número, 10 ou 11 dígitos.
  whatsapp: z.string().trim().refine((v) => {
    const d = v.replace(/\D/g, '')
    return d.length === 10 || d.length === 11
  }, 'Informe um WhatsApp válido com DDD.'),
  delivery_city_id: z.string().uuid().nullable(),
  observacoes: z.string().trim().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  // Qualquer staff do tenant pode gerenciar clientes (decisão do PO,
  // Fase 3 Inc 2, 04/09/2026) - diferente de /painel/equipe (admin-only),
  // dado menos sensível, consistente com a leitura da listagem (Inc 1).

  const body = await request.json().catch(() => null)
  const parsed = clienteCreateSchema.safeParse(body)
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

  const admin = createAdminClient()
  const whatsappDigitos = parsed.data.whatsapp.replace(/\D/g, '')

  // Senha aleatória que ninguém vê/loga - o cliente define a própria via
  // o e-mail de "definir senha" (mesmo mecanismo do passo 3 de
  // /api/painel/equipe). SEM app_metadata - handle_new_user decide
  // `customers` por ausência de role, não por presença de nenhum campo.
  const senhaAleatoria = randomBytes(24).toString('base64url')
  const { data: novoUsuario, error: erroCriar } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: senhaAleatoria,
    email_confirm: true,
    user_metadata: {
      nome: parsed.data.nome,
      whatsapp: whatsappDigitos,
      delivery_city_id: parsed.data.delivery_city_id ?? '',
    },
  })
  if (erroCriar || !novoUsuario.user) {
    const message = erroCriar?.message?.includes('already been registered')
      ? 'Já existe uma conta com esse e-mail.'
      : 'Não foi possível criar a conta.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // handle_new_user roda na mesma transação do INSERT em auth.users - a
  // linha em customers já existe aqui, sem corrida/retry.
  const { data: clienteCriado, error: erroBusca } = await admin
    .from('customers')
    .select('id, nome, email, whatsapp, ativo, delivery_city_id, observacoes')
    .eq('auth_user_id', novoUsuario.user.id)
    .maybeSingle()

  if (erroBusca || !clienteCriado) {
    return NextResponse.json(
      { error: 'A conta foi criada, mas não foi possível confirmar o cadastro do cliente.' },
      { status: 500 }
    )
  }

  // observacoes não faz parte do metadata do trigger (só nome/whatsapp/
  // delivery_city_id) - UPDATE simples à parte, mesmo padrão do whatsapp
  // de staff em POST /api/painel/equipe. Falha aqui não desfaz a criação.
  let clienteFinal = clienteCriado
  if (parsed.data.observacoes) {
    const { data: clienteComObs } = await admin
      .from('customers')
      .update({ observacoes: parsed.data.observacoes })
      .eq('id', clienteCriado.id)
      .select('id, nome, email, whatsapp, ativo, delivery_city_id, observacoes')
      .single()
    if (clienteComObs) clienteFinal = clienteComObs
  }

  // Dispara o e-mail de "definir senha" - reaproveita 100% o mecanismo já
  // testado (REGRAS_DE_NEGOCIO.md §18.4), sem template novo. Falha aqui
  // NÃO desfaz a criação - a tela oferece "reenviar" depois.
  const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const origin = new URL(request.url).origin
  const { error: erroEmail } = await anon.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/nova-senha`,
  })

  return NextResponse.json({ data: clienteFinal, emailEnviado: !erroEmail }, { status: 201 })
}
