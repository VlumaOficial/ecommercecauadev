import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { slugify } from '@/lib/category-tree'
import { derivarPrefixo } from '@/lib/produto-codigo'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

const categoriaInputSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da categoria.'),
  slug: z.string().trim().optional().default(''),
  parent_id: z.string().uuid().nullable().optional().default(null),
  descricao: z.string().trim().optional().default(''),
  ativo: z.boolean().optional().default(true),
  prefixo_codigo: z.string().trim().optional().default(''),
})

// Insere a categoria tratando a colisao do indice unico de prefixo:
// se o prefixo veio VAZIO (o lojista deixou o sistema derivar), tenta
// ajustar sozinho com sufixo numerico (CIC, CIC2, CIC3...) ate achar
// um livre. Se veio DIGITADO pelo lojista, colisao vira erro - nao
// inventa outro valor por baixo dos panos.
async function inserirComPrefixo(
  supabase: SupabaseServerClient,
  dados: { nome: string; slug: string; parent_id: string | null; descricao: string | null; ativo: boolean },
  prefixoDigitado: string
) {
  const derivando = !prefixoDigitado
  const prefixoBase = derivando ? derivarPrefixo(dados.nome) : prefixoDigitado
  const maxTentativas = derivando ? 20 : 1

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    // Colidiu? Desempata com um sufixo numerico de 4 digitos colado no
    // prefixo (BET, BET0001, BET0002...) - formato decidido com o
    // usuario em 01/08/2026 (mais previsivel que BET2/BET3).
    const prefixoTentativa =
      tentativa === 0 ? prefixoBase : `${prefixoBase}${String(tentativa).padStart(4, '0')}`
    const { data, error } = await supabase
      .from('categories')
      .insert({ ...dados, prefixo_codigo: prefixoTentativa || null })
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
    // derivando automaticamente: colidiu, tenta o proximo sufixo
  }

  return {
    data: null,
    error: 'Não foi possível gerar um prefixo único para esta categoria automaticamente. Digite um prefixo manualmente.',
  }
}

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
    .select('id, nome, slug, descricao, parent_id, ordem, ativo, inativado_em_cascata, prefixo_codigo')
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
  const { data, error } = await inserirComPrefixo(
    supabase,
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

  return NextResponse.json({ data }, { status: 201 })
}
