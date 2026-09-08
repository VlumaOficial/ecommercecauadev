import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { criarProdutoComoStaff, filtrarProdutosComoStaff, sanitizarBuscaProduto } from '@/lib/painel/produtos'

export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'ativos'
  const busca = sanitizarBuscaProduto(searchParams.get('busca')?.trim() ?? '')
  const categoryId = searchParams.get('category_id')?.trim() ?? ''

  const supabase = await createClient()
  const { data, error, variacoesPorProduto } = await filtrarProdutosComoStaff(supabase, { status, busca, categoryId })
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
