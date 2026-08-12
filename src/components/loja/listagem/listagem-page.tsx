import { Breadcrumb } from '@/components/loja/breadcrumb'
import { FiltroCategoriasTree } from '@/components/loja/listagem/filtro-categorias-tree'
import { FiltrosToolbar } from '@/components/loja/listagem/filtros-toolbar'
import { ProductGrid } from '@/components/loja/product-grid'
import { contarPorCategoria, filtrarEOrdenarProdutos, type Ordenacao } from '@/lib/loja/filtros'
import { getPath, getSelfAndDescendantIds } from '@/lib/loja/category-tree'
import type { CategoriaPublica, ProdutoPublico } from '@/lib/loja/types'

// Conteudo compartilhado por /categoria/[slug] (categoria fixa, vinda
// da URL) e /produtos (sem categoria - "todos" ou resultado de busca
// vinda do campo do header). Filtragem/ordenacao roda aqui, no
// Server Component, a partir de searchParams - nao existe estado de
// filtro no client, cada mudanca e' uma navegacao normal (mesmo
// padrao de URL state ja usado no painel).
export async function ListagemPage({
  categorias,
  produtos,
  categoriaAtual,
  termoBusca,
  searchParams,
}: {
  categorias: CategoriaPublica[]
  produtos: ProdutoPublico[]
  categoriaAtual: CategoriaPublica | null
  termoBusca: string
  searchParams: { disponivel?: string; promocao?: string; ordenar?: string }
}) {
  const idsCategoriaAtual = categoriaAtual ? getSelfAndDescendantIds(categoriaAtual.id, categorias) : null
  const apenasDisponivel = searchParams.disponivel === '1'
  const apenasPromocao = searchParams.promocao === '1'
  const ordenar = (searchParams.ordenar as Ordenacao | undefined) ?? 'relevancia'

  const filtrados = filtrarEOrdenarProdutos(produtos, {
    idsCategoria: idsCategoriaAtual,
    termo: termoBusca,
    apenasDisponivel,
    apenasPromocao,
    ordenar,
  })

  // Contagem por categoria ignora o filtro de categoria em si (senao
  // toda categoria fora da selecionada mostraria 0), mas respeita
  // busca/disponibilidade/promocao.
  const semFiltroCategoria = filtrarEOrdenarProdutos(produtos, { termo: termoBusca, apenasDisponivel, apenasPromocao })
  const idsPorCategoria = new Map(categorias.map((c) => [c.id, getSelfAndDescendantIds(c.id, categorias)]))
  const contagem = contarPorCategoria(semFiltroCategoria, idsPorCategoria)

  const caminho = categoriaAtual ? getPath(categoriaAtual.id, categorias) : []
  const breadcrumbItens = categoriaAtual
    ? caminho.map((c, i) => ({ label: c.nome, href: i === caminho.length - 1 ? undefined : `/categoria/${c.slug}` }))
    : termoBusca
      ? [{ label: `Busca: "${termoBusca}"` }]
      : [{ label: 'Todos os produtos' }]

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Breadcrumb itens={breadcrumbItens} />
      <h1 className="mt-2 font-display text-2xl font-bold text-foreground">
        {categoriaAtual?.nome ?? (termoBusca ? `Resultados para "${termoBusca}"` : 'Todos os produtos')}
      </h1>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:border-r lg:border-border lg:pr-5">
          <FiltroCategoriasTree
            categorias={categorias}
            contagem={contagem}
            categoriaAtualId={categoriaAtual?.id ?? null}
            totalGeral={semFiltroCategoria.length}
          />
        </aside>
        <div>
          <FiltrosToolbar totalResultados={filtrados.length} />
          <div className="mt-4">
            <ProductGrid produtos={filtrados} />
          </div>
        </div>
      </div>
    </div>
  )
}
