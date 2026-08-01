import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { slugify } from '@/lib/category-tree'

// Sanitiza a busca antes de montar o filtro .or() do PostgREST: virgula
// e parenteses tem significado especial na sintaxe do or-filter e
// quebrariam a query se vierem do texto digitado pelo usuario.
function sanitizarBusca(busca: string) {
  return busca.replace(/[(),]/g, ' ').trim()
}

export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'ativos'
  const busca = sanitizarBusca(searchParams.get('busca')?.trim() ?? '')
  const categoryId = searchParams.get('category_id')?.trim() ?? ''

  const supabase = await createClient()
  let query = supabase
    .from('products_com_status')
    .select('*')
    .order('nome', { ascending: true })

  if (status === 'ativos') query = query.eq('ativo', true)
  else if (status === 'inativos') query = query.eq('ativo', false)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (busca) query = query.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%`)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Não foi possível carregar os produtos. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}

const variacaoInputSchema = z.object({
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

const produtoInputSchema = z.object({
  produto: z.object({
    category_id: z.string().uuid('Selecione uma categoria.'),
    nome: z.string().trim().min(1, 'Informe o nome do produto.'),
    descricao: z.string().trim().optional().default(''),
    unidade_venda_id: z.string().uuid('Selecione a unidade de venda.'),
    destaque: z.boolean().optional().default(false),
    ativo: z.boolean().optional().default(true),
    codigo_visivel: z.boolean().optional().default(false),
  }),
  codigo_modo: z.enum(['automatico', 'manual']),
  codigo_manual: z.string().trim().optional().default(''),
  variacoes: z.array(variacaoInputSchema).min(1, 'Adicione pelo menos uma variação para o produto.'),
})

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = produtoInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  const { produto, codigo_modo, codigo_manual, variacoes } = parsed.data
  const supabase = await createClient()

  let codigoFinal: string
  if (codigo_modo === 'automatico') {
    const { data: codigoGerado, error: codigoError } = await supabase.rpc('gerar_codigo_produto', {
      p_category_id: produto.category_id,
    })
    if (codigoError) {
      return NextResponse.json({ error: codigoError.message }, { status: 400 })
    }
    codigoFinal = codigoGerado as string
  } else {
    if (!codigo_manual) {
      return NextResponse.json({ error: 'Informe um código ou escolha o modo automático.' }, { status: 400 })
    }
    codigoFinal = codigo_manual
  }

  const slugFinal = slugify(produto.nome)
  if (!slugFinal) {
    return NextResponse.json(
      { error: 'Não foi possível gerar uma URL válida a partir do nome.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase.rpc('criar_produto_com_variacoes', {
    p_produto: {
      category_id: produto.category_id,
      nome: produto.nome,
      slug: slugFinal,
      descricao: produto.descricao || null,
      unidade_venda_id: produto.unidade_venda_id,
      destaque: produto.destaque,
      ativo: produto.ativo,
      codigo: codigoFinal,
      codigo_visivel: produto.codigo_visivel,
    },
    p_variacoes: variacoes.map((v) => ({
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

  return NextResponse.json({ data }, { status: 201 })
}
