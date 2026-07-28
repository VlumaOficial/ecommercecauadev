import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

export default async function QuemSou() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const perfil = await getStaffProfile()

  return (
    <pre style={{ padding: 24, fontSize: 14 }}>
      {JSON.stringify({
        logado: !!user,
        email: user?.email ?? null,
        user_id: user?.id ?? null,
        perfil_encontrado: !!perfil,
        perfil,
      }, null, 2)}
    </pre>
  )
}
