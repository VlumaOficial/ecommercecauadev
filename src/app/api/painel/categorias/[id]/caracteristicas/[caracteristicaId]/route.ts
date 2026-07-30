import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const caracteristicaUpdateSchema = z.object({
  rotulo: z.string().trim().min(1, 'Informe o nome da caracteristica.'),
  tipo: z.enum(['texto', 'numero', 'selecao', 'booleano']),
  opcoes: z.array(z.string().trim().min(1)).optional().default([]),
  obrigatorio: z.boolean(),
  usar_em_filtro: z.boolean(),
  ativo: z.boolean(),
})

const ativoOnlySchema = z.object({ ativo: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caracteristicaId: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id, caracteristicaId } = await params
  const body = await request.json().catch(() => null)
  const supabase = await createClient()

  // Toggle rapido de status: payload so com { ativo }
  if (body && Object.keys(body).length === 1 && ativoOnlySchema.safeParse(body).success) {
    const { data, error } = await supabase
      .from('category_attributes')
      .update({ ativo: body.ativo })
      .eq('id', caracteristicaId)
      .eq('category_id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  const parsed = caracteristicaUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados invalidos.' },
      { status: 400 }
    )
  }

  if (parsed.data.tipo === 'selecao' && parsed.data.opcoes.length === 0) {
    return NextResponse.json(
      { error: 'Informe pelo menos uma opcao para o tipo selecao.' },
      { status: 400 }
    )
  }

  // Nota: chave NAO e regenerada aqui mesmo se o rotulo mudar -
  // permanece estavel desde a criacao (ver route.ts do POST).
  const { data, error } = await supabase
    .from('category_attributes')
    .update({
      rotulo: parsed.data.rotulo,
      tipo: parsed.data.tipo,
      opcoes: parsed.data.tipo === 'selecao' ? parsed.data.opcoes : null,
      obrigatorio: parsed.data.obrigatorio,
      usar_em_filtro: parsed.data.usar_em_filtro,
      ativo: parsed.data.ativo,
    })
    .eq('id', caracteristicaId)
    .eq('category_id', id)
    .select()
    .single()

  if (error) {
    const message =
      error.code === '23505' ? 'Ja existe uma caracteristica com esse nome nesta categoria.' : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
