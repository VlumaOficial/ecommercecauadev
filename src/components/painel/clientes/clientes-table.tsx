'use client'

import { useRouter } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import type { ClienteResumo } from '@/hooks/use-clientes'

export function ClientesTable({ clientes, isLoading }: { clientes: ClienteResumo[]; isLoading: boolean }) {
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
