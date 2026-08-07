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
// saldo numerico). Sem view dedicada: busca produtos ATIVOS primeiro
// (produto inativado nao deve aparecer na tela de dia a dia de
// Estoque, mesmo que a variacao em si continue com ativo=true - o
// toggle rapido de produto so mexe em products.ativo, nunca cascateia
// pra product_variants.ativo, ver route.ts do toggle), depois busca só
// as variacoes desses produtos + merge em JS (mesmo padrao ja usado no
// resto do painel pra evitar embedding do PostgREST). Ordena por nome
// do produto e so depois por nome da variacao - variacao sozinha
// ("Padrao" se repete em varios produtos) nao e uma chave de
// ordenacao estavel nem util pro lojista. Status e sempre derivado
// aqui, nunca armazenado (mesmo principio de products_com_status).
export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'todos'
  const busca = searchParams.get('busca')?.trim().toLowerCase() ?? ''

  const supabase = await createClient()

  const { data: produtos, error: errProdutos } = await supabase
    .from('products')
    .select('id, nome')
    .eq('ativo', true)

  if (errProdutos) {
    return NextResponse.json({ error: 'Não foi possível carregar o estoque. Tente novamente.' }, { status: 400 })
  }

  const productIds = (produtos ?? []).map((p) => p.id)
  const nomeProdutoPorId = new Map((produtos ?? []).map((p) => [p.id, p.nome]))

  let variantes: {
    id: string
    nome: string
    sku: string | null
    saldo_estoque: number
    quantidade_minima_estoque: number
    product_id: string
  }[] = []

  if (productIds.length > 0) {
    const { data, error: errVariantes } = await supabase
      .from('product_variants')
      .select('id, nome, sku, saldo_estoque, quantidade_minima_estoque, product_id')
      .eq('ativo', true)
      .eq('modo_estoque', 'quantitativo')
      .in('product_id', productIds)

    if (errVariantes) {
      return NextResponse.json({ error: 'Não foi possível carregar o estoque. Tente novamente.' }, { status: 400 })
    }

    variantes = data ?? []
  }

  let itens = variantes.map((v) => ({
    id: v.id,
    produto_id: v.product_id,
    produto_nome: nomeProdutoPorId.get(v.product_id) ?? '',
    variacao_nome: v.nome,
    sku: v.sku,
    saldo_estoque: v.saldo_estoque,
    quantidade_minima_estoque: v.quantidade_minima_estoque,
    status: calcularStatus(v.saldo_estoque, v.quantidade_minima_estoque),
  }))

  itens.sort(
    (a, b) => a.produto_nome.localeCompare(b.produto_nome) || a.variacao_nome.localeCompare(b.variacao_nome)
  )

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
