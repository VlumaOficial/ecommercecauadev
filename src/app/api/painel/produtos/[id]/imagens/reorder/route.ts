import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1) })

// Mesmo padrao do reorder de Caracteristicas: best-effort (N updates
// independentes, nao uma transacao so) - e so ordem de exibicao, sem
// invariante de negocio a proteger. Validacao extra especifica daqui:
// todas as imagens no payload precisam pertencer ao mesmo escopo
// (todas do produto, ou todas da MESMA variacao) - misturar escopos
// bagunçaria a ordem de duas galerias diferentes de uma vez.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id: productId } = await params
  const body = await request.json().catch(() => null)
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: existentes, error: errExistentes } = await supabase
    .from('product_images')
    .select('id, variant_id')
    .eq('product_id', productId)

  if (errExistentes) {
    return NextResponse.json({ error: errExistentes.message }, { status: 400 })
  }

  const porId = new Map((existentes ?? []).map((img) => [img.id, img.variant_id]))
  if (!parsed.data.ids.every((imgId) => porId.has(imgId))) {
    return NextResponse.json({ error: 'Uma ou mais imagens não pertencem a este produto.' }, { status: 400 })
  }

  const escopos = new Set(parsed.data.ids.map((imgId) => porId.get(imgId)))
  if (escopos.size > 1) {
    return NextResponse.json(
      { error: 'Não é possível reordenar imagens de escopos diferentes juntas.' },
      { status: 400 }
    )
  }

  const resultados = await Promise.all(
    parsed.data.ids.map((imgId, index) =>
      supabase.from('product_images').update({ ordem: index }).eq('id', imgId)
    )
  )
  const erro = resultados.find((r) => r.error)
  if (erro?.error) {
    return NextResponse.json({ error: erro.error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
