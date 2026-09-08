import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { filtrarProdutosComoStaff, sanitizarBuscaProduto } from '@/lib/painel/produtos'

// Frente A (Gestão de Catálogo em Escala), incremento 2 - aprovado pelo
// PO em 04/09/2026. Devolve o catálogo (respeitando os MESMOS filtros
// da listagem - status/busca/category_id, via filtrarProdutosComoStaff,
// a mesma função de GET /api/painel/produtos) já achatado no formato
// de 15 colunas do Inc 1 - o browser só gera o arquivo (CSV/XLSX) a
// partir do JSON, sem geração de planilha no servidor (volume atual do
// tenant é baixo, ~70 produtos - sem necessidade de paginação/stream).
//
// Round-trip: isto é LEITURA, não atualização. Reimportar um export
// sem editar nada pelo Inc 1 vai esbarrar no `codigo` já existente de
// cada produto (RPC rejeita cada linha) - atualizar de verdade (casar
// por código/SKU) é o Inc 4, não construído.
export type LinhaExportacao = {
  identificador: string
  nome: string
  descricao: string
  categoria: string
  unidade: string
  codigo: string
  destaque: string
  codigo_visivel: string
  variacao_nome: string
  sku: string
  preco: string
  preco_promocional: string
  estoque: string
  quantidade_minima_estoque: string
  quantidade_minima_venda: string
}

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
  const { data: produtos, error } = await filtrarProdutosComoStaff(supabase, { status, busca, categoryId })
  if (error) {
    return NextResponse.json({ error: 'Não foi possível exportar os produtos. Tente novamente.' }, { status: 400 })
  }

  const produtoIds = (produtos ?? []).map((p) => p.id!).filter(Boolean)
  if (produtoIds.length === 0) {
    return NextResponse.json({ linhas: [] satisfies LinhaExportacao[] })
  }

  const [{ data: unidades }, { data: variacoes }] = await Promise.all([
    supabase.from('unidades_venda').select('id, nome').eq('tenant_id', perfil.tenant_id),
    // Só variações ATIVAS - o formato de 15 colunas não tem como
    // representar "inativa"; incluir enganaria o lojista fazendo
    // parecer que está à venda (decisão registrada com o PO).
    supabase
      .from('product_variants')
      .select('id, product_id, nome, sku, preco, preco_promocional, saldo_estoque, quantidade_minima_estoque, quantidade_minima_venda')
      .in('product_id', produtoIds)
      .eq('ativo', true)
      .order('created_at', { ascending: true }),
  ])

  const unidadePorId = new Map((unidades ?? []).map((u) => [u.id, u.nome]))
  const variacoesPorProduto = new Map<string, NonNullable<typeof variacoes>>()
  for (const v of variacoes ?? []) {
    const lista = variacoesPorProduto.get(v.product_id) ?? []
    lista.push(v)
    variacoesPorProduto.set(v.product_id, lista)
  }

  const linhas: LinhaExportacao[] = []
  for (const produto of produtos ?? []) {
    const variacoesDoProduto = variacoesPorProduto.get(produto.id!) ?? []
    // Produto sem nenhuma variação ativa não tem como virar linha
    // neste formato (toda linha É uma variação) - fica de fora do
    // export, mesmo princípio de excluir variação inativa.
    if (variacoesDoProduto.length === 0) continue

    // Identificador de agrupamento não existe no banco (artefato só do
    // CSV) - usa o próprio código do produto (único por tenant,
    // imutável) quando há 2+ variações; vazio pra produto de 1
    // variação, mesma convenção do Inc 1.
    const identificador = variacoesDoProduto.length > 1 ? produto.codigo ?? '' : ''

    variacoesDoProduto.forEach((v, index) => {
      linhas.push({
        identificador,
        nome: index === 0 ? produto.nome ?? '' : '',
        descricao: index === 0 ? produto.descricao ?? '' : '',
        categoria: index === 0 ? produto.categoria_nome ?? '' : '',
        unidade: index === 0 ? unidadePorId.get(produto.unidade_venda_id ?? '') ?? '' : '',
        codigo: index === 0 ? produto.codigo ?? '' : '',
        destaque: index === 0 ? (produto.destaque ? 'sim' : 'não') : '',
        codigo_visivel: index === 0 ? (produto.codigo_visivel ? 'sim' : 'não') : '',
        variacao_nome: v.nome,
        sku: v.sku ?? '',
        preco: String(v.preco),
        preco_promocional: v.preco_promocional !== null ? String(v.preco_promocional) : '',
        // Saldo ATUAL (foto do momento), não um "estoque inicial" -
        // mesmo header do Inc 1 por compatibilidade de formato.
        estoque: String(v.saldo_estoque ?? 0),
        quantidade_minima_estoque: String(v.quantidade_minima_estoque ?? 1),
        quantidade_minima_venda: String(v.quantidade_minima_venda ?? 1),
      })
    })
  }

  return NextResponse.json({ linhas })
}
