'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type StatusFiltro = 'ativos' | 'inativos' | 'todos'

const OPCOES: { value: StatusFiltro; rotulo: string }[] = [
  { value: 'ativos', rotulo: 'Ativos' },
  { value: 'inativos', rotulo: 'Inativos' },
  { value: 'todos', rotulo: 'Todos' },
]

export function StatusFilterTabs({
  value,
  onChange,
}: {
  value: StatusFiltro
  onChange: (value: StatusFiltro) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as StatusFiltro)}>
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
