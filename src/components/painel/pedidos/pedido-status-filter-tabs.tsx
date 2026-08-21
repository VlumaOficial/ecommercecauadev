'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PedidoStatusFiltro } from '@/hooks/use-pedidos'

const OPCOES: { value: PedidoStatusFiltro; rotulo: string }[] = [
  { value: 'aguardando_validacao', rotulo: 'Aguardando confirmação' },
  { value: 'confirmado', rotulo: 'Confirmado' },
  { value: 'concluido', rotulo: 'Concluído' },
  { value: 'cancelado', rotulo: 'Cancelado' },
  { value: 'todos', rotulo: 'Todos' },
]

export function PedidoStatusFilterTabs({
  value,
  onChange,
}: {
  value: PedidoStatusFiltro
  onChange: (value: PedidoStatusFiltro) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as PedidoStatusFiltro)}>
      <TabsList>
        {OPCOES.map((op) => (
          <TabsTrigger key={op.value} value={op.value}>
            {op.rotulo}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
