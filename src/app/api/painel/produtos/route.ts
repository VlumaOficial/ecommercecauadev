import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { criarProdutoComoStaff } from '@/lib/painel/produtos'

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

  // product_id -> variacoes que bateram na busca (so preenchido quando
  // ha busca) - permite a listagem mostrar QUAL variacao casou, nao so
  // que o produto casou. Populado abaixo, antes do .or() principal.
  const variacoesPorProduto = new Map<
    string,
    { id: string; nome: string; sku: string | null; bateu_sku: boolean; bateu_nome: boolean }[]
  >()

  if (busca) {
    // Busca tambem por SKU/rotulo de variacao: acha os product_id que
    // batem numa query separada (product_variants nao e' exposto pela
    // view products_com_status, que agrega/agrupa as variacoes) e
    // inclui no .or() principal via id.in.(...). Nao filtra por
    // variacao ativa/inativa de proposito - staff pode estar
    // procurando o produto por um SKU ja inativado.
    const { data: variantMatches } = await supabase
      .from('product_variants')
      .select('id, product_id, nome, sku')
      .or(`sku.ilike.%${busca}%,nome.ilike.%${busca}%`)

    const buscaLower = busca.toLowerCase()
    for (const v of variantMatches ?? []) {
      const bateuSku = !!v.sku && v.sku.toLowerCase().includes(buscaLower)
      const bateuNome = !!v.nome && v.nome.toLowerCase().includes(buscaLower)
      if (!bateuSku && !bateuNome) continue
      const lista = variacoesPorProduto.get(v.product_id) ?? []
      lista.push({ id: v.id, nome: v.nome, sku: v.sku, bateu_sku: bateuSku, bateu_nome: bateuNome })
      variacoesPorProduto.set(v.product_id, lista)
    }
    const idsPorVariacao = [...variacoesPorProduto.keys()]

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

  const resultado = busca
    ? (data ?? []).map((p) => ({ ...p, variacoes_encontradas: variacoesPorProduto.get(p.id!) ?? [] }))
    : data

  return NextResponse.json({ data: resultado })
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

  const resultado = await criarProdutoComoStaff(supabase, {
    produto: {
      category_id: produto.category_id,
      nome: produto.nome,
      descricao: produto.descricao || null,
      unidade_venda_id: produto.unidade_venda_id,
      destaque: produto.destaque,
      ativo: produto.ativo,
      codigo_visivel: produto.codigo_visivel,
    },
    codigo_modo,
    codigo_manual,
    variacoes,
    caracteristicas,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  return NextResponse.json({ data: resultado.produto }, { status: 201 })
}
