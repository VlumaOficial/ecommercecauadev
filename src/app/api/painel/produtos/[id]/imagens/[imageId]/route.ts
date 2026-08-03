import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const altTextSchema = z.object({ alt_text: z.string().trim().optional().default('') })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id: productId, imageId } = await params
  const body = await request.json().catch(() => null)
  const parsed = altTextSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_images')
    .update({ alt_text: parsed.data.alt_text || null })
    .eq('id', imageId)
    .eq('product_id', productId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Não foi possível atualizar a imagem.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}

// Exclusao REAL (nao soft delete - excecao explicita registrada em
// ESCOPO_PROJETO.md). Storage primeiro: se a remocao do arquivo
// falhar, aborta antes de mexer na tabela - nunca fica um arquivo
// removido com a linha ainda apontando pra ele, nem uma linha
// removida com o arquivo ainda ocupando espaco sem referencia nenhuma
// (o segundo caso e o unico residuo aceito, ver nota no plano).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id: productId, imageId } = await params
  const supabase = await createClient()

  const { data: imagem, error: findError } = await supabase
    .from('product_images')
    .select('id, storage_path')
    .eq('id', imageId)
    .eq('product_id', productId)
    .maybeSingle()

  if (findError || !imagem) {
    return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 })
  }

  const { error: removeError } = await supabase.storage.from('product-images').remove([imagem.storage_path])
  if (removeError) {
    return NextResponse.json({ error: 'Não foi possível remover a imagem. Tente novamente.' }, { status: 400 })
  }

  const { error: deleteError } = await supabase.from('product_images').delete().eq('id', imageId)
  if (deleteError) {
    return NextResponse.json(
      { error: 'A imagem foi removida do armazenamento, mas houve um erro ao atualizar o cadastro. Atualize a página.' },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true })
}
