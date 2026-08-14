import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import type { ConfiguracaoVitrineCampos } from '@/lib/loja/types'

// Le a configuracao da Vitrine (publicado + rascunho) do tenant do
// staff logado, via get_configuracao_vitrine (migration 031) - staff
// only, isolado por current_tenant_id() dentro da RPC.
export async function GET() {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_configuracao_vitrine')
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: error?.message ?? 'Configuração não encontrada.' }, { status: 400 })
  }

  const row = data[0]
  const publicado: ConfiguracaoVitrineCampos = {
    logo_path: row.logo_path,
    banner_titulo: row.banner_titulo,
    banner_subtitulo: row.banner_subtitulo,
    banner_botao_texto: row.banner_botao_texto,
    banner_botao_href: row.banner_botao_href,
    banner_tipo_fundo: row.banner_tipo_fundo as 'cor' | 'imagem',
    banner_cor_fundo: row.banner_cor_fundo,
    banner_imagem_path: row.banner_imagem_path,
    selos: row.selos as ConfiguracaoVitrineCampos['selos'],
    whatsapp_numero: row.whatsapp_numero,
    whatsapp_mensagem: row.whatsapp_mensagem,
    cor_principal: row.cor_principal,
  }

  return NextResponse.json({
    data: {
      nome: row.nome,
      publicado,
      rascunho: (row.rascunho as ConfiguracaoVitrineCampos | null) ?? null,
    },
  })
}
