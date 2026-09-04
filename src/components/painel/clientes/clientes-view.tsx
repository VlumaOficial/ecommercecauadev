'use client'

import { useQueryParamState } from '@/hooks/use-query-param-state'
import { useClientes } from '@/hooks/use-clientes'
import { useCidades } from '@/hooks/use-cidades'
import { StatusFilterTabs, type StatusFiltro } from '@/components/painel/crud/status-filter-tabs'
import { SearchInput } from '@/components/painel/crud/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClientesTable } from './clientes-table'

export function ClientesView() {
  const [status, setStatus] = useQueryParamState('status', 'ativos')
  const [busca, setBusca] = useQueryParamState('busca', '')
  const [cidade, setCidade] = useQueryParamState('cidade', '')

  const { data: clientes = [], isLoading } = useClientes({
    status: status as StatusFiltro,
    busca,
    cidade,
  })
  // Só cidades ativas no filtro - cidade inativa não recebe pedido novo,
  // mas um cliente antigo pode ter uma delivery_city_id inativa; nesse
  // caso ele só não aparece filtrando por aquela cidade específica (seria
  // preciso listar inativas também pra cobrir 100% - fora do escopo do
  // Inc 1, sem impacto na massa de teste atual).
  const { data: cidades = [] } = useCidades({ status: 'ativos', busca: '' })

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Clientes</h1>
        <p className="text-muted-foreground mt-1">Consulte o histórico e as métricas de cada cliente.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <StatusFilterTabs value={status as StatusFiltro} onChange={setStatus} />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={cidade || 'todas'} onValueChange={(v) => setCidade(!v || v === 'todas' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-48">
              {/* SelectValue sem children renderiza o `value` cru (achado
                  testando na HML: mostrava "todas"/o uuid da cidade em vez
                  do rótulo) - render-prop resolve o rótulo certo. */}
              <SelectValue placeholder="Todas as cidades">
                {(value: string) => {
                  if (!value || value === 'todas') return 'Todas as cidades'
                  if (value === 'sem_cidade') return 'Sem cidade'
                  const selecionada = cidades.find((c) => c.id === value)
                  return selecionada ? `${selecionada.nome}${selecionada.uf ? ' - ' + selecionada.uf : ''}` : 'Todas as cidades'
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as cidades</SelectItem>
              <SelectItem value="sem_cidade">Sem cidade</SelectItem>
              {cidades.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                  {c.uf ? ` - ${c.uf}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchInput
            defaultValue={busca}
            onChange={setBusca}
            placeholder="Buscar por nome, e-mail ou WhatsApp..."
            className="w-full sm:w-72"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-2">
        <ClientesTable clientes={clientes} isLoading={isLoading} />
      </div>
    </div>
  )
}
