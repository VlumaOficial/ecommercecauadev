import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Item (4) da sequencia pre-incremento 8 (ESCOPO_PROJETO.md §0 item
// 49/50) - modulo de Configuracao. GET: qualquer staff (so leitura).
// PATCH: admin-only, gate em app + RLS `settings_admin_write`
// (migration 013) por baixo - defesa em profundidade, mesmo padrao
// ja usado em /painel/equipe. Sem RPC nova, sem migration nova -
// update direto em store_settings, form unico salva direto (sem
// rascunho/publicar como a Vitrine - esses campos nao sao conteudo
// publico editorial, sao regra de negocio operacional).
const COLUNAS =
  'loja_aberta, mensagem_loja_fechada, pedidos_abertos, mensagem_pedidos_fechados, permite_autocadastro, valor_minimo_pedido_habilitado, valor_minimo_pedido, cancelamento_automatico_habilitado, prazo_cancelamento_automatico_horas'

const configuracoesSchema = z.object({
  loja_aberta: z.boolean(),
  mensagem_loja_fechada: z.string().trim().min(1, 'Informe a mensagem de loja fechada.'),
  pedidos_abertos: z.boolean(),
  mensagem_pedidos_fechados: z.string().trim().min(1, 'Informe a mensagem de pedidos fechados.'),
  permite_autocadastro: z.boolean(),
  valor_minimo_pedido_habilitado: z.boolean(),
  valor_minimo_pedido: z.coerce.number().min(0, 'Informe um valor válido.'),
  cancelamento_automatico_habilitado: z.boolean(),
  prazo_cancelamento_automatico_horas: z.coerce
    .number()
    .int('Use um número inteiro de horas.')
    .positive('O prazo deve ser maior que zero.'),
})

export async function GET() {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('store_settings').select(COLUNAS).single()
  if (error) {
    return NextResponse.json({ error: 'Não foi possível carregar as configurações.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  if (perfil.role !== 'admin') {
    return NextResponse.json({ error: 'Só administradores podem alterar as configurações.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = configuracoesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('store_settings')
    .update(parsed.data)
    .eq('tenant_id', perfil.tenant_id)
    .select(COLUNAS)
    .single()
  if (error) {
    return NextResponse.json({ error: 'Não foi possível salvar as configurações.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}
