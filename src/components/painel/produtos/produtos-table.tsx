'use client'

import { PowerIcon, RotateCcwIcon } from 'lucide-react'
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
import { formatarMoeda } from '@/lib/utils'
import type { Produto } from '@/hooks/use-produtos'

export function ProdutosTable({
  produtos,
  isLoading,
  onInativar,
  onReativar,
}: {
  produtos: Produto[]
  isLoading: boolean
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
          <TableHead>Preço a partir de</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produtos.map((produto) => (
          <TableRow key={produto.id}>
            <TableCell className="font-medium">{produto.nome}</TableCell>
            <TableCell className="text-muted-foreground">{produto.codigo ?? '—'}</TableCell>
            <TableCell>{produto.categoria_nome ?? '—'}</TableCell>
            <TableCell>{formatarMoeda(produto.preco_a_partir_de)}</TableCell>
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
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
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
