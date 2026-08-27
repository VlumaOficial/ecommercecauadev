'use client'

import { useRouter } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PedidoStatusBadge } from '@/components/loja/pedidos/status-badge'
import { Preco } from '@/components/ui/preco'
import type { PedidoResumo } from '@/hooks/use-pedidos'

export function PedidosTable({ pedidos, isLoading }: { pedidos: PedidoResumo[]; isLoading: boolean }) {
  const router = useRouter()

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (pedidos.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Cidade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pedidos.map((pedido) => (
          <TableRow
            key={pedido.id}
            tabIndex={0}
            onClick={() => router.push(`/painel/pedidos/${pedido.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push(`/painel/pedidos/${pedido.id}`)
            }}
            className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <TableCell className="font-medium">#{pedido.numero}</TableCell>
            <TableCell>{pedido.cliente_nome}</TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {pedido.cidade_nome ? `${pedido.cidade_nome}${pedido.cidade_uf ? ' - ' + pedido.cidade_uf : ''}` : '—'}
            </TableCell>
            <TableCell>
              <PedidoStatusBadge status={pedido.status} />
            </TableCell>
            <TableCell className="text-right font-semibold"><Preco valor={pedido.total} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
