'use client'

import { PencilIcon, PowerIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import type { UnidadeVenda } from '@/hooks/use-unidades-venda'

export function UnidadesVendaTable({
  unidades,
  isLoading,
  onEdit,
  onInativar,
  onReativar,
}: {
  unidades: UnidadeVenda[]
  isLoading: boolean
  onEdit: (unidade: UnidadeVenda) => void
  onInativar: (unidade: UnidadeVenda) => void
  onReativar: (unidade: UnidadeVenda) => void
}) {
  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (unidades.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhuma unidade de venda encontrada.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {unidades.map((unidade) => (
          <TableRow key={unidade.id}>
            <TableCell className="font-medium">{unidade.nome}</TableCell>
            <TableCell>
              <StatusBadge ativo={unidade.ativo} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => onEdit(unidade)} aria-label="Editar unidade de venda">
                  <PencilIcon />
                </Button>
                {unidade.ativo ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onInativar(unidade)}
                    aria-label="Inativar unidade de venda"
                  >
                    <PowerIcon />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onReativar(unidade)}
                    aria-label="Reativar unidade de venda"
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
