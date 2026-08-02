'use client'

import { ArrowRightLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EstoqueStatusBadge } from './estoque-status-badge'
import type { ItemEstoque } from '@/hooks/use-estoque'

export function EstoqueTable({
  itens,
  isLoading,
  onRowClick,
  onMovimentar,
}: {
  itens: ItemEstoque[]
  isLoading: boolean
  onRowClick: (item: ItemEstoque) => void
  onMovimentar: (item: ItemEstoque) => void
}) {
  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (itens.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhuma variação encontrada.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Variação</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead className="text-right">Saldo atual</TableHead>
          <TableHead className="text-right">Mínimo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((item) => (
          <TableRow
            key={item.id}
            tabIndex={0}
            onClick={() => onRowClick(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRowClick(item)
            }}
            className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <TableCell className="font-medium">{item.produto_nome}</TableCell>
            <TableCell>{item.variacao_nome}</TableCell>
            <TableCell className="text-muted-foreground">{item.sku ?? '—'}</TableCell>
            <TableCell className="text-right">{item.saldo_estoque}</TableCell>
            <TableCell className="text-right text-muted-foreground">{item.quantidade_minima}</TableCell>
            <TableCell>
              <EstoqueStatusBadge status={item.status} />
            </TableCell>
            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onMovimentar(item)}
                aria-label="Registrar movimentação"
                title="Registrar movimentação"
              >
                <ArrowRightLeftIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
