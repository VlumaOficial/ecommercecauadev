'use client'

import { useRouter } from 'next/navigation'
import { MailIcon, PencilIcon, PowerIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import type { ClienteResumo } from '@/hooks/use-clientes'

export function ClientesTable({
  clientes,
  isLoading,
  onEdit,
  onInativar,
  onReativar,
  onReenviarSenha,
}: {
  clientes: ClienteResumo[]
  isLoading: boolean
  onEdit: (cliente: ClienteResumo) => void
  onInativar: (cliente: ClienteResumo) => void
  onReativar: (cliente: ClienteResumo) => void
  onReenviarSenha: (cliente: ClienteResumo) => void
}) {
  const router = useRouter()

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (clientes.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>WhatsApp</TableHead>
          <TableHead>Cidade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Pedidos</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.map((cliente) => (
          <TableRow
            key={cliente.id}
            tabIndex={0}
            onClick={() => router.push(`/painel/clientes/${cliente.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push(`/painel/clientes/${cliente.id}`)
            }}
            className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <TableCell className="font-medium">{cliente.nome}</TableCell>
            <TableCell className="text-muted-foreground">{cliente.email}</TableCell>
            <TableCell className="text-muted-foreground">{cliente.whatsapp}</TableCell>
            <TableCell className="text-muted-foreground">
              {cliente.cidade_nome ? `${cliente.cidade_nome}${cliente.cidade_uf ? ' - ' + cliente.cidade_uf : ''}` : '—'}
            </TableCell>
            <TableCell>
              <StatusBadge ativo={cliente.ativo} />
            </TableCell>
            <TableCell className="text-right font-semibold">{cliente.numero_pedidos}</TableCell>
            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onReenviarSenha(cliente)}
                  aria-label={`Reenviar link de senha para ${cliente.nome}`}
                  title="Reenviar link de senha"
                >
                  <MailIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => onEdit(cliente)} aria-label={`Editar ${cliente.nome}`}>
                  <PencilIcon />
                </Button>
                {cliente.ativo ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onInativar(cliente)}
                    aria-label={`Desativar ${cliente.nome}`}
                  >
                    <PowerIcon />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onReativar(cliente)}
                    aria-label={`Reativar ${cliente.nome}`}
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
