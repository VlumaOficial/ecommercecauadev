import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const HEX = /^#[0-9a-fA-F]{6}$/
const WHATSAPP = /^[0-9]{10,15}$/

const seloSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título do selo.'),
  subtitulo: z.string().trim().min(1, 'Informe o subtítulo do selo.'),
  icone: z.string().trim().min(1, 'Selecione um ícone.'),
  ativo: z.boolean(),
})

const configuracaoSchema = z.object({
  logo_path: z.string().trim().min(1).nullable(),
  banner_titulo: z.string().trim().min(1, 'Informe o título do banner.'),
  banner_subtitulo: z.string().trim().min(1, 'Informe o subtítulo do banner.'),
  banner_botao_texto: z.string().trim().min(1, 'Informe o texto do botão.'),
  banner_botao_href: z.string().trim().min(1, 'Informe o destino do botão.'),
  banner_tipo_fundo: z.enum(['cor', 'imagem']),
  banner_cor_fundo: z.string().regex(HEX, 'Cor inválida - use o formato #RRGGBB.'),
  banner_imagem_path: z.string().trim().min(1).nullable(),
  selos: z.array(seloSchema).length(4, 'São sempre 4 selos.'),
  whatsapp_numero: z
    .string()
    .regex(WHATSAPP, 'Número inválido - use DDI+DDD+número, só dígitos (10 a 15).')
    .nullable(),
  whatsapp_mensagem: z.string().trim().min(1, 'Informe a mensagem pré-preenchida.'),
  cor_principal: z.string().regex(HEX, 'Cor inválida - use o formato #RRGGBB.'),
})

// Grava o snapshot em edicao (store_settings.rascunho, migration 031)
// via salvar_rascunho_vitrine - nunca afeta a vitrine publica. Validado
// aqui com as MESMAS regras das CHECK constraints dos campos
// publicados (defesa em profundidade, mesmo padrao do resto do
// painel) - mesmo que passe daqui com erro, publicar_vitrine ainda
// bloqueia por causa das constraints reais no banco.
export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = configuracaoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('salvar_rascunho_vitrine', { p_rascunho: parsed.data })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
