import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { slugify } from '@/lib/category-tree'

const caracteristicaInputSchema = z.object({
  rotulo: z.string().trim().min(1, 'Informe o nome da caracteristica.'),
  tipo: z.enum(['texto', 'numero', 'selecao', 'booleano']),
  opcoes: z.array(z.string().trim().min(1)).optional().default([]),
  obrigatorio: z.boolean().optional().default(false),
  usar_em_filtro: z.boolean().optional().default(false),
  ativo: z.boolean().optional().default(true),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('category_attributes')
    .select('*')
    .eq('category_id', id)
    .order('ordem', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}

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
  const parsed = caracteristicaInputSchema.safeParse(body)
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

  // Chave gerada uma unica vez, na criacao, e nunca muda depois -
  // diferente do slug de categoria (que segue o nome). E um
  // identificador interno estavel; renomear o rotulo nao deve
  // quebrar quem referenciar a caracteristica pela chave no futuro
  // (ex.: product_attribute_values).
  const chave = slugify(parsed.data.rotulo)
  if (!chave) {
    return NextResponse.json(
      { error: 'Nao foi possivel gerar uma chave valida a partir do nome.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: ultima } = await supabase
    .from('category_attributes')
    .select('ordem')
    .eq('category_id', id)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('category_attributes')
    .insert({
      category_id: id,
      chave,
      rotulo: parsed.data.rotulo,
      tipo: parsed.data.tipo,
      opcoes: parsed.data.tipo === 'selecao' ? parsed.data.opcoes : null,
      obrigatorio: parsed.data.obrigatorio,
      usar_em_filtro: parsed.data.usar_em_filtro,
      ativo: parsed.data.ativo,
      ordem: (ultima?.ordem ?? -1) + 1,
    })
    .select()
    .single()

  if (error) {
    const message =
      error.code === '23505' ? 'Ja existe uma caracteristica com esse nome nesta categoria.' : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
