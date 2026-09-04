'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, MessageCircleIcon } from 'lucide-react'
import { useCliente } from '@/hooks/use-clientes'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import { PedidoStatusBadge } from '@/components/loja/pedidos/status-badge'
import { Preco } from '@/components/ui/preco'

// Mesmo padrao de formatarWhatsappExibicao ja duplicado em
// pedido-detalhe-view.tsx / equipe-table.tsx (so' exibicao) - numero
// armazenado sem mascara, DDD+numero.
function formatarWhatsappExibicao(digitos: string) {
  const d = digitos.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digitos
}

export function ClienteDetalheView({ id }: { id: string }) {
  const router = useRouter()
  const { data: cliente, isLoading, error } = useCliente(id)

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (error || !cliente) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {error?.message ?? 'Cliente não encontrado.'}
      </p>
    )
  }

  // created_at/pedidos.created_at sao timestamptz (instante real) - new
  // Date() e' o certo aqui, nao formatarDataISO (essa e' so' pra colunas
  // `date` puras, ver ESCOPO_PROJETO.md §2 "fuso na exibicao de data").
  const whatsappDigitos = cliente.whatsapp.replace(/\D/g, '')
  const whatsappHref = whatsappDigitos
    ? `https://wa.me/55${whatsappDigitos}?text=${encodeURIComponent(`Olá ${cliente.nome}!`)}`
    : null

  return (
    <div className="max-w-3xl">
      <Link
        href="/painel/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Clientes
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">{cliente.nome}</h1>
        <StatusBadge ativo={cliente.ativo} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Dados do cliente</h2>
          <p className="text-sm text-foreground">{cliente.email}</p>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] hover:underline"
            >
              <MessageCircleIcon className="size-4" />
              {formatarWhatsappExibicao(cliente.whatsapp)}
            </a>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {cliente.cidade ? `${cliente.cidade.nome}${cliente.cidade.uf ? ' - ' + cliente.cidade.uf : ''}` : 'Sem cidade cadastrada'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Cadastrado em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Métricas</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Nº de pedidos</dt>
              <dd className="font-semibold text-foreground">{cliente.metricas.numero_pedidos}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Total gasto</dt>
              <dd className="font-semibold text-foreground"><Preco valor={cliente.metricas.total_gasto} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Ticket médio</dt>
              <dd className="font-semibold text-foreground"><Preco valor={cliente.metricas.ticket_medio} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Última compra</dt>
              <dd className="font-semibold text-foreground">
                {cliente.metricas.ultima_compra
                  ? new Date(cliente.metricas.ultima_compra).toLocaleDateString('pt-BR')
                  : '—'}
              </dd>
            </div>
          </dl>
          {/* Complementar, fora da media - nao entra em total gasto/ticket medio */}
          <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
            Pedidos cancelados: {cliente.metricas.pedidos_cancelados}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Histórico de pedidos</h2>
        {cliente.pedidos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Este cliente ainda não fez pedidos.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cliente.pedidos.map((pedido) => (
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
                  <TableCell className="text-muted-foreground">
                    {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <PedidoStatusBadge status={pedido.status} />
                  </TableCell>
                  <TableCell className="text-right font-semibold"><Preco valor={pedido.total} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <Button type="button" variant="outline" onClick={() => router.push('/painel/clientes')}>
          Voltar para clientes
        </Button>
      </div>
    </div>
  )
}
