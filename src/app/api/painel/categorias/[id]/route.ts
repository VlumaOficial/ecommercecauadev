import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { getDescendantIds, slugify } from '@/lib/category-tree'
import { derivarPrefixo } from '@/lib/produto-codigo'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

const categoriaUpdateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da categoria.'),
  slug: z.string().trim().optional().default(''),
  parent_id: z.string().uuid().nullable().optional().default(null),
  descricao: z.string().trim().optional().default(''),
  ativo: z.boolean(),
  prefixo_codigo: z.string().trim().optional().default(''),
})

// Mesma logica de ajuste automatico de colisao do POST (ver route.ts
// da listagem) - aqui pro caso de UPDATE.
async function atualizarComPrefixo(
  supabase: SupabaseServerClient,
  id: string,
  dados: { nome: string; slug: string; parent_id: string | null; descricao: string | null; ativo: boolean },
  prefixoDigitado: string
) {
  const derivando = !prefixoDigitado
  const prefixoBase = derivando ? derivarPrefixo(dados.nome) : prefixoDigitado
  const maxTentativas = derivando ? 20 : 1

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    // Mesmo formato de sufixo do POST (ver route.ts da listagem):
    // BET, BET0001, BET0002...
    const prefixoTentativa =
      tentativa === 0 ? prefixoBase : `${prefixoBase}${String(tentativa).padStart(4, '0')}`
    const { data, error } = await supabase
      .from('categories')
      .update({ ...dados, prefixo_codigo: prefixoTentativa || null })
      .eq('id', id)
      .select()
      .single()

    if (!error) return { data, error: null as string | null }

    const colidiuNoPrefixo = error.code === '23505' && error.message.includes('idx_categories_prefixo_codigo')
    if (!colidiuNoPrefixo) {
      const message = error.code === '23505' ? 'Ja existe uma categoria com esse slug.' : error.message
      return { data: null, error: message }
    }
    if (!derivando) {
      return { data: null, error: 'Já existe uma categoria com este prefixo. Escolha outro.' }
    }
  }

  return {
    data: null,
    error: 'Não foi possível gerar um prefixo único para esta categoria automaticamente. Digite um prefixo manualmente.',
  }
}

const ativoOnlySchema = z.object({ ativo: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const supabase = await createClient()

  // Toggle rapido de status: payload so com { ativo }. Passa pela RPC
  // (nao update direto) pra aplicar a cascata em subarvore de forma
  // atomica — ver migration 011.
  if (body && Object.keys(body).length === 1 && ativoOnlySchema.safeParse(body).success) {
    const { error: rpcError } = await supabase.rpc('set_category_ativo_cascade', {
      p_category_id: id,
      p_ativo: body.ativo,
    })
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 400 })

    const { data, error } = await supabase.from('categories').select().eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  const parsed = categoriaUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados invalidos.' },
      { status: 400 }
    )
  }

  // Validacao anti-ciclo (defesa em profundidade: o combobox ja exclui
  // essas opcoes no client, mas o servidor precisa garantir tambem).
  if (parsed.data.parent_id) {
    if (parsed.data.parent_id === id) {
      return NextResponse.json(
        { error: 'Uma categoria nao pode ser pai dela mesma.' },
        { status: 400 }
      )
    }

    const { data: todas, error: errTodas } = await supabase
      .from('categories')
      .select('id, parent_id')

    if (errTodas) {
      return NextResponse.json({ error: errTodas.message }, { status: 400 })
    }

    const descendentes = getDescendantIds(id, todas ?? [])
    if (descendentes.has(parsed.data.parent_id)) {
      return NextResponse.json(
        { error: 'A categoria-pai nao pode ser uma subcategoria da propria categoria (isso criaria um ciclo).' },
        { status: 400 }
      )
    }
  }

  const slugFinal = slugify(parsed.data.slug || parsed.data.nome)
  if (!slugFinal) {
    return NextResponse.json(
      { error: 'Nao foi possivel gerar um slug valido a partir do nome.' },
      { status: 400 }
    )
  }

  const { data, error } = await atualizarComPrefixo(
    supabase,
    id,
    {
      nome: parsed.data.nome,
      slug: slugFinal,
      parent_id: parsed.data.parent_id,
      descricao: parsed.data.descricao || null,
      ativo: parsed.data.ativo,
    },
    parsed.data.prefixo_codigo.trim().toUpperCase()
  )

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ data })
}
