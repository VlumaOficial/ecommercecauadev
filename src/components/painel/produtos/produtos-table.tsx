'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { PencilIcon, PowerIcon, RotateCcwIcon, TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import { HighlightMatch } from './highlight-match'
import type { Produto } from '@/hooks/use-produtos'

const COLUNAS = 5

export function ProdutosTable({
  produtos,
  isLoading,
  busca = '',
  onRowClick,
  onInativar,
  onReativar,
}: {
  produtos: Produto[]
  isLoading: boolean
  // So usada pra destacar o trecho que bateu na faixa de variacao
  // encontrada (produto.variacoes_encontradas) - a filtragem em si ja
  // aconteceu no servidor.
  busca?: string
  onRowClick: (produto: Produto) => void
  onInativar: (produto: Produto) => void
  onReativar: (produto: Produto) => void
}) {
  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (produtos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhum produto encontrado.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produtos.map((produto) => (
          <Fragment key={produto.id}>
            <TableRow
              tabIndex={0}
              onClick={() => onRowClick(produto)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRowClick(produto)
              }}
              className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
            >
              <TableCell className="font-medium">{produto.nome}</TableCell>
              <TableCell className="text-muted-foreground">{produto.codigo ?? '—'}</TableCell>
              <TableCell>{produto.categoria_nome ?? '—'}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge ativo={!!produto.ativo} />
                  {produto.esgotado && <Badge variant="secondary">Esgotado</Badge>}
                  {produto.em_promocao && (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                    >
                      Promoção
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={<Link href={`/painel/produtos/${produto.id}`} />}
                    nativeButton={false}
                    aria-label="Editar produto"
                  >
                    <PencilIcon />
                  </Button>
                  {produto.ativo ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onInativar(produto)}
                      aria-label="Inativar produto"
                    >
                      <PowerIcon />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onReativar(produto)}
                      aria-label="Reativar produto"
                    >
                      <RotateCcwIcon />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            {produto.variacoes_encontradas?.map((v) => (
              <TableRow key={v.id} className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={COLUNAS} className="py-2 pl-8 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <TagIcon className="size-3.5 shrink-0" />
                      Variação encontrada:{' '}
                      <span className="font-medium text-foreground">
                        <HighlightMatch text={v.nome} query={v.bateu_nome ? busca : ''} />
                      </span>
                    </span>
                    {v.sku && (
                      <span>
                        SKU:{' '}
                        <code className="rounded bg-background px-1 py-0.5 font-mono text-xs text-foreground">
                          <HighlightMatch text={v.sku} query={v.bateu_sku ? busca : ''} />
                        </code>
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}
