'use client'

import Link from 'next/link'
import { PencilIcon, PowerIcon, RotateCcwIcon } from 'lucide-react'
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
import type { Produto } from '@/hooks/use-produtos'

export function ProdutosTable({
  produtos,
  isLoading,
  onRowClick,
  onInativar,
  onReativar,
}: {
  produtos: Produto[]
  isLoading: boolean
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
          <TableRow
            key={produto.id}
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
        ))}
      </TableBody>
    </Table>
  )
}
