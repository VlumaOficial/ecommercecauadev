import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Confirma que todos os IDs pertencem a esta categoria antes de
  // aplicar qualquer coisa (evita reordenar caracteristica de outra
  // categoria por um payload manipulado).
  const { data: existentes, error: errExistentes } = await supabase
    .from('category_attributes')
    .select('id')
    .eq('category_id', id)

  if (errExistentes) {
    return NextResponse.json({ error: errExistentes.message }, { status: 400 })
  }

  const idsValidos = new Set((existentes ?? []).map((c) => c.id))
  if (!parsed.data.ids.every((cid) => idsValidos.has(cid))) {
    return NextResponse.json(
      { error: 'Uma ou mais caracteristicas nao pertencem a esta categoria.' },
      { status: 400 }
    )
  }

  // Best-effort (N updates independentes, nao uma transacao so): risco
  // baixo o suficiente pra nao justificar uma RPC aqui - e so ordem de
  // exibicao, sem invariante de negocio pra proteger (diferente da
  // cascata de categorias). Uma falha parcial se autocorrige no
  // proximo reorder completo.
  const resultados = await Promise.all(
    parsed.data.ids.map((cid, index) =>
      supabase.from('category_attributes').update({ ordem: index }).eq('id', cid)
    )
  )
  const erro = resultados.find((r) => r.error)
  if (erro?.error) {
    return NextResponse.json({ error: erro.error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
