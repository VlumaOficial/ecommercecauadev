import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { slugify } from '@/lib/category-tree'
import { derivarPrefixo } from '@/lib/produto-codigo'

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

  if (busca) {
    // Busca tambem por SKU/rotulo de variacao: acha os product_id que
    // batem numa query separada (product_variants nao e' exposto pela
    // view products_com_status, que agrega/agrupa as variacoes) e
    // inclui no .or() principal via id.in.(...). Nao filtra por
    // variacao ativa/inativa de proposito - staff pode estar
    // procurando o produto por um SKU ja inativado.
    const { data: variantMatches } = await supabase
      .from('product_variants')
      .select('product_id')
      .or(`sku.ilike.%${busca}%,nome.ilike.%${busca}%`)
    const idsPorVariacao = [...new Set((variantMatches ?? []).map((v) => v.product_id))]

    const condicoes = [`nome.ilike.%${busca}%`, `codigo.ilike.%${busca}%`]
    if (idsPorVariacao.length > 0) {
      condicoes.push(`id.in.(${idsPorVariacao.join(',')})`)
    }
    query = query.or(condicoes.join(','))
  }

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
  // Opcional (decisao do modulo de Estoque, migration 022): so usado
  // se o lojista preencher no cadastro - vira movimentacao de
  // inventario na RPC, nunca grava saldo_estoque direto.
  estoque_inicial: z
    .union([z.literal(''), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  // Dois minimos distintos (migration 027, decisao de produto
  // 07/08/2026 - "quantidade_minima" era ambigua): estoque = nivel de
  // alerta de reposicao (modulo de Estoque, "abaixo do minimo"); venda
  // = minimo de compra do cliente (regra de checkout futura, sem uso
  // ainda).
  quantidade_minima_estoque: z.coerce.number().optional().default(1),
  quantidade_minima_venda: z.coerce.number().optional().default(1),
})

// Etapa 2 (Caracteristicas): um item por caracteristica preenchida no
// form (o client so envia as ATIVAS da categoria selecionada, ver
// produto-form.tsx). "valor" vazio e valido (limpa/nao preenche) - a
// RPC trata via nullif. Obrigatoriedade e responsabilidade da RPC
// (fonte da verdade), nao validada aqui - mensagem amigavel ja vem
// pronta do "raise exception" dela.
const caracteristicaInputSchema = z.object({
  attribute_id: z.string().uuid(),
  valor: z.string().optional().default(''),
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
  codigo_modo: z.enum(['automatico', 'categoria', 'manual']),
  codigo_manual: z.string().trim().optional().default(''),
  variacoes: z.array(variacaoInputSchema).min(1, 'Adicione pelo menos uma variação para o produto.'),
  caracteristicas: z.array(caracteristicaInputSchema).optional().default([]),
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

  const { produto, codigo_modo, codigo_manual, variacoes, caracteristicas } = parsed.data
  const supabase = await createClient()

  let codigoFinal: string
  if (codigo_modo === 'automatico') {
    // Prefixo derivado do NOME DO PRODUTO (decisao #24), calculado no
    // servidor a partir do nome ja validado - nunca confia num prefixo
    // vindo do client, mesmo que o peek (codigo-sugerido) ja tenha
    // mostrado a mesma coisa. Sequencia propria por prefixo (migration
    // 024), independente da sequencia por categoria.
    const prefixo = derivarPrefixo(produto.nome)
    if (!prefixo) {
      return NextResponse.json(
        { error: 'Não foi possível gerar um código a partir do nome do produto.' },
        { status: 400 }
      )
    }
    const { data: codigoGerado, error: codigoError } = await supabase.rpc('gerar_codigo_produto_por_prefixo', {
      p_prefixo: prefixo,
    })
    if (codigoError) {
      return NextResponse.json({ error: codigoError.message }, { status: 400 })
    }
    codigoFinal = codigoGerado as string
  } else if (codigo_modo === 'categoria') {
    const { data: codigoGerado, error: codigoError } = await supabase.rpc('gerar_codigo_produto', {
      p_category_id: produto.category_id,
    })
    if (codigoError) {
      return NextResponse.json({ error: codigoError.message }, { status: 400 })
    }
    codigoFinal = codigoGerado as string
  } else {
    if (!codigo_manual) {
      return NextResponse.json({ error: 'Informe um código ou escolha um modo automático.' }, { status: 400 })
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
      estoque_inicial: v.estoque_inicial ?? undefined,
      quantidade_minima_estoque: v.quantidade_minima_estoque,
      quantidade_minima_venda: v.quantidade_minima_venda,
    })),
    p_caracteristicas: caracteristicas,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
