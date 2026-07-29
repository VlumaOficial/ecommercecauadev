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
import type { Cidade } from '@/hooks/use-cidades'

export function CidadesTable({
  cidades,
  isLoading,
  onEdit,
  onInativar,
  onReativar,
}: {
  cidades: Cidade[]
  isLoading: boolean
  onEdit: (cidade: Cidade) => void
  onInativar: (cidade: Cidade) => void
  onReativar: (cidade: Cidade) => void
}) {
  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (cidades.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhuma cidade encontrada.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>UF</TableHead>
          <TableHead>Ponto de entrega</TableHead>
          <TableHead>Horario</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cidades.map((cidade) => (
          <TableRow key={cidade.id}>
            <TableCell className="font-medium">{cidade.nome}</TableCell>
            <TableCell>{cidade.uf ?? '-'}</TableCell>
            <TableCell className="max-w-48 truncate">{cidade.ponto_entrega ?? '-'}</TableCell>
            <TableCell>{cidade.horario ?? '-'}</TableCell>
            <TableCell>
              <StatusBadge ativo={cidade.ativo} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => onEdit(cidade)} aria-label="Editar cidade">
                  <PencilIcon />
                </Button>
                {cidade.ativo ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onInativar(cidade)}
                    aria-label="Inativar cidade"
                  >
                    <PowerIcon />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onReativar(cidade)}
                    aria-label="Reativar cidade"
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
