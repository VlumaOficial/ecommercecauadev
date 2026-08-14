import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Gera um token de preview (gerar_token_preview_vitrine, migration
// 031) e monta o link publico https://{dominio}/preview?token={token}
// - o dominio vem de tenant_domains (o mesmo host onde a vitrine
// publica do tenant abre), NUNCA do host que serviu este request (que
// é o host do painel, diferente do host da loja - ver proxy.ts).
export async function POST() {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('gerar_token_preview_vitrine')
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: error?.message ?? 'Não foi possível gerar o link.' }, { status: 400 })
  }

  const { token, dominio } = data[0]
  if (!dominio) {
    return NextResponse.json(
      { error: 'Este tenant ainda não tem domínio cadastrado (tenant_domains) - não é possível gerar o link de prévia.' },
      { status: 400 }
    )
  }

  return NextResponse.json({ data: { url: `https://${dominio}/preview?token=${token}` } })
}
