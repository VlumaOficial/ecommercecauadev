import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { slugify } from '@/lib/category-tree'

const categoriaInputSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da categoria.'),
  slug: z.string().trim().optional().default(''),
  parent_id: z.string().uuid().nullable().optional().default(null),
  descricao: z.string().trim().optional().default(''),
  ativo: z.boolean().optional().default(true),
})

// Retorna a arvore inteira (todos os status): filtro de status/busca
// e aplicado no cliente, pra poder preservar o caminho ate a raiz dos
// nos que batem no filtro (ver lib/category-tree.ts).
export async function GET() {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, nome, slug, descricao, parent_id, ordem, ativo, inativado_em_cascata')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = categoriaInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados invalidos.' },
      { status: 400 }
    )
  }

  const slugFinal = slugify(parsed.data.slug || parsed.data.nome)
  if (!slugFinal) {
    return NextResponse.json(
      { error: 'Nao foi possivel gerar um slug valido a partir do nome.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .insert({
      nome: parsed.data.nome,
      slug: slugFinal,
      parent_id: parsed.data.parent_id,
      descricao: parsed.data.descricao || null,
      ativo: parsed.data.ativo,
    })
    .select()
    .single()

  if (error) {
    const message = error.code === '23505' ? 'Ja existe uma categoria com esse slug.' : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
