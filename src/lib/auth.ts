import { createClient } from '@/lib/supabase/server'

export type StaffProfile = {
  id: string
  nome: string
  email: string
  role: 'admin' | 'operador'
  pode_aceitar_pedido: boolean
}

// Retorna o perfil da equipe (admin/operador) do usuario logado, ou null.
export async function getStaffProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, nome, email, role, pode_aceitar_pedido')
    .eq('id', user.id)
    .eq('ativo', true)
    .maybeSingle()

  return (data as StaffProfile | null) ?? null
}
