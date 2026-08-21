import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export type StaffProfile = {
  id: string
  nome: string
  email: string
  role: 'admin' | 'operador'
  pode_aceitar_pedido: boolean
  tenant_id: string
}

// Consulta o perfil de equipe (admin/operador) de um usuario ja autenticado
// no client informado. Reaproveitada pelo login (client em memoria, sem
// cookies gravados ainda) e por getStaffProfile() (client do request).
export async function getStaffProfileForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StaffProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, nome, email, role, pode_aceitar_pedido, tenant_id')
    .eq('id', userId)
    .eq('ativo', true)
    .maybeSingle()

  return (data as StaffProfile | null) ?? null
}

// Retorna o perfil da equipe (admin/operador) do usuario logado, ou null.
export async function getStaffProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  return getStaffProfileForUser(supabase, user.id)
}

export type CustomerProfile = {
  id: string
  nome: string
  email: string | null
  whatsapp: string
  delivery_city_id: string | null
  tenant_id: string
}

// Retorna o perfil do cliente (vitrine) logado, ou null - mesmo padrao de
// getStaffProfile(), usado pelo gate de sessao do checkout (Fase 2,
// incremento 5). Cliente e staff nunca sao a mesma coisa (REGRAS_DE_NEGOCIO.md
// §1/§14) - por isso e' uma consulta separada em customers, nao um branch
// dentro de getStaffProfile().
export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('customers')
    .select('id, nome, email, whatsapp, delivery_city_id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('ativo', true)
    .maybeSingle()

  return (data as CustomerProfile | null) ?? null
}
