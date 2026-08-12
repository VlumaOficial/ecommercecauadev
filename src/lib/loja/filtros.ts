import type { ProdutoPublico } from '@/lib/loja/types'

export type Ordenacao = 'relevancia' | 'menor-preco' | 'maior-preco' | 'novidade' | 'nome-az'

export function filtrarEOrdenarProdutos(
  produtos: ProdutoPublico[],
  opts: {
    idsCategoria?: Set<string> | null
    termo?: string
    apenasDisponivel?: boolean
    apenasPromocao?: boolean
    ordenar?: Ordenacao
  }
): ProdutoPublico[] {
  const termo = opts.termo?.trim().toLowerCase() ?? ''

  let lista = produtos.filter((p) => {
    if (opts.idsCategoria && !opts.idsCategoria.has(p.category_id)) return false
    if (termo && !p.nome.toLowerCase().includes(termo) && !(p.descricao ?? '').toLowerCase().includes(termo)) return false
    if (opts.apenasDisponivel && p.esgotado) return false
    if (opts.apenasPromocao && !p.em_promocao) return false
    return true
  })

  lista = [...lista]
  switch (opts.ordenar) {
    case 'menor-preco':
      lista.sort((a, b) => (a.preco_a_partir_de ?? Infinity) - (b.preco_a_partir_de ?? Infinity))
      break
    case 'maior-preco':
      lista.sort((a, b) => (b.preco_a_partir_de ?? -Infinity) - (a.preco_a_partir_de ?? -Infinity))
      break
    case 'nome-az':
      lista.sort((a, b) => a.nome.localeCompare(b.nome))
      break
    case 'novidade':
      lista.sort((a, b) => Number(b.novidade) - Number(a.novidade))
      break
    default:
      // 'relevancia' - mantem a ordem que ja veio da RPC (p.ordem, p.nome)
      break
  }
  return lista
}

// Contagem por categoria (raiz+descendentes), respeitando os filtros
// de disponibilidade/promocao/busca ja aplicados - so' NAO aplica o
// filtro de categoria em si (senao toda categoria fora da selecionada
// mostraria 0). Mesmo principio ja usado no filtro de categoria do
// painel (contador reflete o filtro de status atual).
export function contarPorCategoria(
  produtosFiltrados: ProdutoPublico[],
  idsPorCategoria: Map<string, Set<string>>
): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const [categoriaId, idsSubarvore] of idsPorCategoria) {
    let n = 0
    for (const p of produtosFiltrados) {
      if (idsSubarvore.has(p.category_id)) n++
    }
    contagem.set(categoriaId, n)
  }
  return contagem
}
