import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type OrderStatus = Database['public']['Enums']['order_status']

const CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  aguardando_validacao: { label: 'Aguardando confirmação', className: 'bg-amber-500/15 text-amber-900' },
  confirmado: { label: 'Confirmado', className: 'bg-blue-500/15 text-blue-900' },
  concluido: { label: 'Concluído', className: 'bg-green-500/15 text-green-900' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive' },
}

export function PedidoStatusBadge({ status }: { status: OrderStatus }) {
  const config = CONFIG[status]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}
