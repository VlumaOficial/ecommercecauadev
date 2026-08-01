import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { slugify } from '@/lib/category-tree'

const ativoOnlySchema = z.object({ ativo: z.boolean() })

const variacaoEdicaoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().optional().default(''),
  sku: z.string().trim().optional().default(''),
  preco: z.coerce.number().min(0, 'O preço não pode ser negativo.'),
  preco_promocional: z
    .union([z.literal(''), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  modo_estoque: z.enum(['quantitativo', 'disponibilidade']).optional().default('quantitativo'),
  saldo_estoque: z.coerce.number().optional().default(0),
  quantidade_minima: z.coerce.number().optional().default(1),
})

const produtoEdicaoSchema = z.object({
  produto: z.object({
    category_id: z.string().uuid('Selecione uma categoria.'),
    nome: z.string().trim().min(1, 'Informe o nome do produto.'),
    descricao: z.string().trim().optional().default(''),
    unidade_venda: z.string().trim().optional().default('unidade'),
    destaque: z.boolean().optional().default(false),
    ativo: z.boolean().optional().default(true),
    codigo_visivel: z.boolean().optional().default(false),
  }),
  variacoes: z.array(variacaoEdicaoSchema).min(1, 'Adicione pelo menos uma variação para o produto.'),
})

// Produto + variacoes ativas, pra hidratar o formulario de edicao.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: produto, error: produtoError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (produtoError || !produto) {
    return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
  }

  const { data: variacoes, error: variacoesError } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', id)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (variacoesError) {
    return NextResponse.json({ error: 'Não foi possível carregar as variações do produto.' }, { status: 400 })
  }

  return NextResponse.json({ data: { ...produto, variacoes: variacoes ?? [] } })
}

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

  // Toggle rapido de status: payload so com { ativo }.
  if (body && Object.keys(body).length === 1 && ativoOnlySchema.safeParse(body).success) {
    const { data, error } = await supabase
      .from('products')
      .update({ ativo: body.ativo })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Não foi possível atualizar o status do produto.' }, { status: 400 })
    }
    return NextResponse.json({ data })
  }

  // Edicao completa: dados do produto + sincronizacao de variacoes,
  // via RPC atomica (migration 017). "codigo" nunca faz parte deste
  // payload - imutavel, nem a RPC aceita esse campo.
  const parsed = produtoEdicaoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  const { produto, variacoes } = parsed.data
  const slugFinal = slugify(produto.nome)
  if (!slugFinal) {
    return NextResponse.json(
      { error: 'Não foi possível gerar uma URL válida a partir do nome.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase.rpc('atualizar_produto_com_variacoes', {
    p_product_id: id,
    p_produto: {
      category_id: produto.category_id,
      nome: produto.nome,
      slug: slugFinal,
      descricao: produto.descricao || null,
      unidade_venda: produto.unidade_venda || 'unidade',
      destaque: produto.destaque,
      ativo: produto.ativo,
      codigo_visivel: produto.codigo_visivel,
    },
    p_variacoes: variacoes.map((v) => ({
      id: v.id || undefined,
      nome: v.nome || undefined,
      sku: v.sku || undefined,
      preco: v.preco,
      preco_promocional: v.preco_promocional ?? undefined,
      modo_estoque: v.modo_estoque,
      saldo_estoque: v.saldo_estoque,
      quantidade_minima: v.quantidade_minima,
    })),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
