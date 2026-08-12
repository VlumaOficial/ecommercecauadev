import Link from 'next/link'

import { cn } from '@/lib/utils'
import { buildTree, type CategoriaTreeNode } from '@/lib/loja/category-tree'
import type { CategoriaPublica } from '@/lib/loja/types'

function Nodo({
  node,
  contagem,
  categoriaAtualId,
  nivel,
}: {
  node: CategoriaTreeNode
  contagem: Map<string, number>
  categoriaAtualId: string | null
  nivel: number
}) {
  const total = contagem.get(node.id) ?? 0
  const ativo = node.id === categoriaAtualId

  return (
    <li>
      <Link
        href={`/categoria/${node.slug}`}
        style={{ paddingLeft: `${nivel * 14}px` }}
        className={cn(
          'flex items-center justify-between gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors',
          ativo ? 'font-semibold text-primary' : 'text-foreground hover:text-primary',
          total === 0 && 'text-muted-foreground'
        )}
      >
        <span className="truncate">{node.nome}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{total}</span>
      </Link>
      {node.filhos.length > 0 && (
        <ul>
          {node.filhos.map((filho) => (
            <Nodo key={filho.id} node={filho} contagem={contagem} categoriaAtualId={categoriaAtualId} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function FiltroCategoriasTree({
  categorias,
  contagem,
  categoriaAtualId,
  totalGeral,
}: {
  categorias: CategoriaPublica[]
  contagem: Map<string, number>
  categoriaAtualId: string | null
  totalGeral: number
}) {
  const arvore = buildTree(categorias)

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">Categorias</h3>
      <ul className="space-y-0.5">
        <li>
          <Link
            href="/produtos"
            className={cn(
              'flex items-center justify-between gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors',
              categoriaAtualId === null ? 'font-semibold text-primary' : 'text-foreground hover:text-primary'
            )}
          >
            <span>Todos os produtos</span>
            <span className="text-xs text-muted-foreground">{totalGeral}</span>
          </Link>
        </li>
        {arvore.map((node) => (
          <Nodo key={node.id} node={node} contagem={contagem} categoriaAtualId={categoriaAtualId} nivel={0} />
        ))}
      </ul>
    </div>
  )
}
