'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EstoqueFiltro } from '@/hooks/use-estoque'

const OPCOES: { value: EstoqueFiltro; rotulo: string }[] = [
  { value: 'todos', rotulo: 'Todos' },
  { value: 'ok', rotulo: 'OK' },
  { value: 'abaixo_do_minimo', rotulo: 'Abaixo do mínimo' },
  { value: 'esgotado', rotulo: 'Esgotado' },
]

export function EstoqueStatusFilterTabs({
  value,
  onChange,
}: {
  value: EstoqueFiltro
  onChange: (value: EstoqueFiltro) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as EstoqueFiltro)}>
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
