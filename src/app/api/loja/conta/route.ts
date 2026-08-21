import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCustomerProfile } from '@/lib/auth'

// Fase 2, incremento 6 (Área do Cliente) - atualiza só nome/whatsapp/
// delivery_city_id. E-mail fica de fora de propósito (é o identificador
// de login gerenciado pelo Supabase Auth - mudar exigiria um fluxo de
// confirmação próprio, fora de escopo aqui).
//
// Defesa em profundidade: a policy "customers_update_own" (migration 013)
// só restringe QUAL LINHA o cliente pode mexer (auth_user_id = auth.uid()),
// não QUAIS COLUNAS - RLS do Postgres não faz controle por coluna. Por
// isso o payload aceito aqui é uma lista fechada via zod (nunca o body
// inteiro repassado pro .update()) - impede o cliente de tentar sobrescrever
// ativo/tenant_id/email/auth_user_id mesmo que o payload venha com esses
// campos.
const contaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe seu nome.'),
  whatsapp: z.string().trim().min(10, 'Informe um WhatsApp válido com DDD.'),
  delivery_city_id: z.string().uuid('Selecione a cidade de entrega.').nullable(),
})

export async function PATCH(request: NextRequest) {
  const cliente = await getCustomerProfile()
  if (!cliente) {
    return NextResponse.json({ error: 'Sua sessão expirou. Faça login novamente.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = contaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()

  if (parsed.data.delivery_city_id) {
    const { data: cidadeOk } = await supabase
      .from('delivery_cities')
      .select('id')
      .eq('id', parsed.data.delivery_city_id)
      .eq('tenant_id', cliente.tenant_id)
      .eq('ativo', true)
      .maybeSingle()
    if (!cidadeOk) {
      return NextResponse.json({ error: 'Cidade de entrega não encontrada.' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('customers')
    // Só estes 3 campos - nunca spread do body (ver nota acima)
    .update({
      nome: parsed.data.nome,
      whatsapp: parsed.data.whatsapp.replace(/\D/g, ''),
      delivery_city_id: parsed.data.delivery_city_id,
    })
    .eq('id', cliente.id)
    .select('id, nome, email, whatsapp, delivery_city_id, tenant_id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Não foi possível salvar seus dados. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}
