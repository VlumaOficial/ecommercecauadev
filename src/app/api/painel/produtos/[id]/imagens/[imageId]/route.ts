import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { removerImagemComoStaff } from '@/lib/painel/produtos'

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
//
// Achado (Frente A, Inc 3, 04/09/2026): so checar `error` do
// `.remove()` nao basta - a chamada pode devolver sucesso (sem
// `error`) com `data` vazio/incompleto quando o Storage nao remove o
// arquivo de verdade (ex.: RLS negando silenciosamente), deixando um
// orfao no bucket. Correcao: confirma que o PATH pedido realmente
// aparece no `data` devolvido antes de considerar a remocao efetiva -
// so ai apaga a linha. Se nao confirmar, a linha PERMANECE (a foto
// continua aparecendo - estado correto) e o erro e reportado, nunca
// apaga a linha as cegas.
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

  const resultado = await removerImagemComoStaff(supabase, { imageId, storagePath: imagem.storage_path })
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
