'use client'

import { useQueryParamState } from '@/hooks/use-query-param-state'
import { usePedidos, type PedidoStatusFiltro } from '@/hooks/use-pedidos'
import { PedidoStatusFilterTabs } from './pedido-status-filter-tabs'
import { PedidosTable } from './pedidos-table'

export function PedidosView() {
  // Default "aguardando_validacao": e' o status acionavel do dia a dia
  // do vendedor (a fila de coisas pra validar), diferente do padrao
  // "ativos" de Produtos/Categorias - aqui nao ha' conceito de
  // ativo/inativo, e' o pedido que precisa de acao agora que importa
  // primeiro.
  const [status, setStatus] = useQueryParamState('status', 'aguardando_validacao')
  const { data: pedidos = [], isLoading } = usePedidos(status as PedidoStatusFiltro)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Pedidos</h1>
        <p className="text-muted-foreground mt-1">Valide, ajuste e acompanhe os pedidos dos clientes.</p>
      </div>

      <div className="mb-4">
        <PedidoStatusFilterTabs
          value={status as PedidoStatusFiltro}
          onChange={(v) => setStatus(v)}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-2">
        <PedidosTable pedidos={pedidos} isLoading={isLoading} />
      </div>
    </div>
  )
}
