import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Melhoria de notificação (c), REGRAS_DE_NEGOCIO.md §18.6c — configuração
// de QUEM da equipe recebe o aviso de "pedido novo" e por qual canal.
// Tabela order_notification_recipients (migration 044).
//
// GET e PUT são ADMIN-ONLY (decisão do PO: "só admin configura quem
// recebe"). Além do gate em app (role === 'admin'), a RLS por baixo:
// - profiles: policy profiles_admin_all (migration 013) — operador nem
//   consegue listar a equipe, então um GET "qualquer staff" não teria
//   como montar a lista de qualquer forma;
// - order_notification_recipients: policy onr_admin_write (migration 044)
//   pro PUT, onr_select_staff pro GET.
// Mesma defesa em profundidade já usada no módulo de Configuração (item 4).

const linhaSchema = z.object({
  profile_id: z.string().uuid(),
  ativo: z.boolean(),
  canal_email: z.boolean(),
  canal_whatsapp: z.boolean(),
})
const putSchema = z.array(linhaSchema)

export async function GET() {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  if (perfil.role !== 'admin') {
    return NextResponse.json(
      { error: 'Apenas administradores podem ver as configurações de notificação.' },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  const [staffRes, recipientsRes] = await Promise.all([
    supabase.from('profiles').select('id, nome, whatsapp').eq('ativo', true).order('nome', { ascending: true }),
    supabase.from('order_notification_recipients').select('profile_id, ativo, canal_email, canal_whatsapp'),
  ])
  if (staffRes.error || recipientsRes.error) {
    return NextResponse.json({ error: 'Não foi possível carregar as configurações de notificação.' }, { status: 400 })
  }

  const porProfile = new Map((recipientsRes.data ?? []).map((r) => [r.profile_id, r]))
  const lista = (staffRes.data ?? []).map((s) => {
    const r = porProfile.get(s.id)
    return {
      profile_id: s.id,
      nome: s.nome,
      tem_whatsapp: !!s.whatsapp,
      ativo: r?.ativo ?? false,
      canal_email: r?.canal_email ?? false,
      canal_whatsapp: r?.canal_whatsapp ?? false,
    }
  })

  return NextResponse.json({ data: lista })
}

export async function PUT(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  if (perfil.role !== 'admin') {
    return NextResponse.json(
      { error: 'Apenas administradores podem alterar as configurações de notificação.' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fonte de verdade da equipe é o banco, nunca o profile_id que o
  // cliente mandou — carrega os staff ATIVOS do tenant (RLS já isola) e
  // valida cada linha CONTRA isso antes de escrever qualquer coisa.
  const { data: staff, error: eStaff } = await supabase
    .from('profiles')
    .select('id, nome, whatsapp')
    .eq('ativo', true)
  if (eStaff || !staff) {
    return NextResponse.json({ error: 'Não foi possível carregar a equipe.' }, { status: 400 })
  }
  const staffById = new Map(staff.map((s) => [s.id, s]))

  // Validação tudo-ou-nada — nenhuma escrita se qualquer linha for inválida.
  const linhas: Array<z.infer<typeof linhaSchema>> = []
  for (const linha of parsed.data) {
    const s = staffById.get(linha.profile_id)
    if (!s) continue // profile_id que não é staff ativo deste tenant: ignora em silêncio (não é erro do admin)

    // "Recebe" ligado exige ao menos um canal — espelha o CHECK
    // onr_ativo_exige_canal (migration 044), mas com mensagem amigável (§9)
    // em vez de deixar o erro cru do banco vazar.
    if (linha.ativo && !linha.canal_email && !linha.canal_whatsapp) {
      return NextResponse.json(
        { error: `Escolha ao menos um canal para ${s.nome}, ou desligue o aviso de novo pedido para essa pessoa.` },
        { status: 400 }
      )
    }

    // Regra cross-table: WhatsApp exige número cadastrado no profile.
    // Validada NO SERVIDOR (o "disabled" no front é só conveniência e
    // pode ser burlado).
    if (linha.canal_whatsapp && !s.whatsapp) {
      return NextResponse.json(
        { error: `${s.nome} não tem WhatsApp cadastrado. Cadastre o número na tela de Equipe ou deixe só o e-mail marcado.` },
        { status: 400 }
      )
    }

    linhas.push(linha)
  }

  // Reconciliação: upsert por (tenant_id, profile_id). tenant_id explícito
  // (= current_tenant_id() pra este admin, exigido pelo with-check de
  // onr_admin_write). Staff desmarcado grava ativo=false e zera os canais
  // (não deixa flag de canal "órfã" numa linha inativa).
  const rows = linhas.map((l) => ({
    tenant_id: perfil.tenant_id,
    profile_id: l.profile_id,
    ativo: l.ativo,
    canal_email: l.ativo ? l.canal_email : false,
    canal_whatsapp: l.ativo ? l.canal_whatsapp : false,
  }))

  if (rows.length > 0) {
    const { error: eUpsert } = await supabase
      .from('order_notification_recipients')
      .upsert(rows, { onConflict: 'tenant_id,profile_id' })
    if (eUpsert) {
      // Rede de segurança: se por algum motivo o CHECK do banco disparar
      // (não deveria — validado acima), responde amigável, não o erro cru.
      if (eUpsert.message?.includes('onr_ativo_exige_canal')) {
        return NextResponse.json(
          { error: 'Um destinatário ficou ativo sem canal selecionado. Revise e tente novamente.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Não foi possível salvar as configurações de notificação.' },
        { status: 400 }
      )
    }
  }

  return NextResponse.json({ data: { ok: true } })
}
