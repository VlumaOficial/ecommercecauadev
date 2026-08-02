import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

type StatusEstoque = 'ok' | 'abaixo_do_minimo' | 'esgotado'

function calcularStatus(saldo: number, minimo: number): StatusEstoque {
  if (saldo === 0) return 'esgotado'
  if (saldo < minimo) return 'abaixo_do_minimo'
  return 'ok'
}

// Listagem de variacoes com controle de estoque (modo_estoque =
// 'quantitativo' - variacoes 'disponibilidade' ficam de fora, nao tem
// saldo numerico). Sem view dedicada: duas queries simples (variacoes,
// depois produtos pelos ids encontrados) + merge em JS, mesmo padrao
// ja usado no resto do painel pra evitar embedding do PostgREST
// (nenhuma outra Route Handler deste projeto usa esse recurso).
// Status e sempre derivado aqui, nunca armazenado (mesmo principio de
// products_com_status).
export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'todos'
  const busca = searchParams.get('busca')?.trim().toLowerCase() ?? ''

  const supabase = await createClient()

  const { data: variantes, error: errVariantes } = await supabase
    .from('product_variants')
    .select('id, nome, sku, saldo_estoque, quantidade_minima, product_id')
    .eq('ativo', true)
    .eq('modo_estoque', 'quantitativo')
    .order('nome', { ascending: true })

  if (errVariantes) {
    return NextResponse.json({ error: 'Não foi possível carregar o estoque. Tente novamente.' }, { status: 400 })
  }

  const productIds = [...new Set((variantes ?? []).map((v) => v.product_id))]
  let nomeProdutoPorId = new Map<string, string>()

  if (productIds.length > 0) {
    const { data: produtos, error: errProdutos } = await supabase
      .from('products')
      .select('id, nome')
      .in('id', productIds)

    if (errProdutos) {
      return NextResponse.json({ error: 'Não foi possível carregar o estoque. Tente novamente.' }, { status: 400 })
    }

    nomeProdutoPorId = new Map((produtos ?? []).map((p) => [p.id, p.nome]))
  }

  let itens = (variantes ?? []).map((v) => ({
    id: v.id,
    produto_id: v.product_id,
    produto_nome: nomeProdutoPorId.get(v.product_id) ?? '',
    variacao_nome: v.nome,
    sku: v.sku,
    saldo_estoque: v.saldo_estoque,
    quantidade_minima: v.quantidade_minima,
    status: calcularStatus(v.saldo_estoque, v.quantidade_minima),
  }))

  if (status !== 'todos') {
    itens = itens.filter((i) => i.status === status)
  }
  if (busca) {
    itens = itens.filter(
      (i) => i.produto_nome.toLowerCase().includes(busca) || (i.sku ?? '').toLowerCase().includes(busca)
    )
  }

  return NextResponse.json({ data: itens })
}
