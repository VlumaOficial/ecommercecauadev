import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const TIPOS_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const TAMANHO_MAXIMO = 5 * 1024 * 1024

// Upload de imagem da identidade da vitrine (banner ou logo, Etapa 4)
// - sobe pro MESMO bucket publico product-images (nao existe bucket
// dedicado a assets de loja ainda), em {tenant_id}/_store-settings/,
// com nome unico (uuid) a cada upload - nunca sobrescreve um arquivo
// ja publicado. tenant_id PRECISA ser o primeiro segmento do path -
// a policy de insert do bucket (migration 023) exige
// (storage.foldername(name))[1] = current_tenant_id(), mesmo padrao
// das fotos de produto.
//
// E' o path unico (nunca reaproveitado) que garante que o rascunho
// nao "vaza" pro publicado so por causa do arquivo: o path novo so
// passa a valer quando o campo correspondente
// (banner_imagem_path/logo_path) for copiado do rascunho pros campos
// publicados em publicar_vitrine().
export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const file = formData.get('file')
  const tipo = (formData.get('tipo') as string | null) ?? 'imagem'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Selecione uma imagem.' }, { status: 400 })
  }
  const extensao = TIPOS_PERMITIDOS[file.type]
  if (!extensao) {
    return NextResponse.json({ error: 'Formato não suportado. Use JPG, PNG ou WebP.' }, { status: 400 })
  }
  if (file.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: 'A imagem é muito grande (máximo 5MB).' }, { status: 400 })
  }

  const nomeArquivo = `${tipo}-${crypto.randomUUID()}.${extensao}`
  const storagePath = `${perfil.tenant_id}/_store-settings/${nomeArquivo}`

  const supabase = await createClient()
  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Não foi possível enviar a imagem. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json({ data: { path: storagePath } }, { status: 201 })
}
