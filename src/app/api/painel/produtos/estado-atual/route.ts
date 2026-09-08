import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Frente A, incremento 4 (atualização em massa via reimportação) -
// único endpoint de LEITURA novo deste incremento. Devolve, pra cada
// código de produto pedido, o estado ATUAL (nome/descrição + preço/
// promocional/saldo/nº de fotos de cada variação ativa) - o browser usa
// isso pra computar o diff do preview ANTES de aplicar qualquer coisa
// (planilha parseada × este estado atual). Código não encontrado
// simplesmente não aparece na resposta - o preview trata como "produto
// será pulado".
export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const codigos = [
    ...new Set(
      (searchParams.get('codigos') ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    ),
  ]
  if (codigos.length === 0) {
    return NextResponse.json({ produtos: [] })
  }

  const supabase = await createClient()
  const { data: produtos, error: erroProdutos } = await supabase
    .from('products')
    .select('id, codigo, nome, descricao')
    .in('codigo', codigos)

  if (erroProdutos) {
    return NextResponse.json({ error: 'Não foi possível carregar o estado atual dos produtos.' }, { status: 400 })
  }

  const produtoIds = (produtos ?? []).map((p) => p.id)
  const [{ data: variacoes }, { data: imagens }] = await Promise.all([
    produtoIds.length === 0
      ? Promise.resolve({ data: [] as { id: string; product_id: string; sku: string | null; preco: number; preco_promocional: number | null; saldo_estoque: number }[] })
      : supabase
          .from('product_variants')
          .select('id, product_id, sku, preco, preco_promocional, saldo_estoque')
          .in('product_id', produtoIds)
          .eq('ativo', true),
    produtoIds.length === 0
      ? Promise.resolve({ data: [] as { variant_id: string | null }[] })
      : supabase.from('product_images').select('variant_id').in('product_id', produtoIds).not('variant_id', 'is', null),
  ])

  const numFotosPorVariante = new Map<string, number>()
  for (const img of imagens ?? []) {
    numFotosPorVariante.set(img.variant_id!, (numFotosPorVariante.get(img.variant_id!) ?? 0) + 1)
  }

  const variacoesPorProduto = new Map<string, NonNullable<typeof variacoes>>()
  for (const v of variacoes ?? []) {
    const lista = variacoesPorProduto.get(v.product_id) ?? []
    lista.push(v)
    variacoesPorProduto.set(v.product_id, lista)
  }

  const resultado = (produtos ?? []).map((p) => ({
    codigo: p.codigo,
    nome: p.nome,
    descricao: p.descricao,
    variacoes: (variacoesPorProduto.get(p.id) ?? []).map((v) => ({
      sku: v.sku,
      preco: v.preco,
      preco_promocional: v.preco_promocional,
      saldo_estoque: v.saldo_estoque,
      num_fotos: numFotosPorVariante.get(v.id) ?? 0,
    })),
  }))

  return NextResponse.json({ produtos: resultado })
}
