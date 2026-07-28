import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export type StaffProfile = {
  id: string
  nome: string
  email: string
  role: 'admin' | 'operador'
  pode_aceitar_pedido: boolean
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
    .select('id, nome, email, role, pode_aceitar_pedido')
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
