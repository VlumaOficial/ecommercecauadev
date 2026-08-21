'use client'

import { useState } from 'react'
import { PencilIcon, RotateCcwIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatarMoeda } from '@/lib/utils'
import { useAjustarPedido, type PedidoDetalhe } from '@/hooks/use-pedidos'

type ItemEdit = { variant_id: string; quantidade: number; removido: boolean }

function estadoInicial(pedido: PedidoDetalhe): ItemEdit[] {
  return pedido.itens.map((item) => ({ variant_id: item.variant_id, quantidade: item.quantidade, removido: false }))
}

// Itens do pedido, com o estoque disponivel ao lado de cada um
// (REGRAS_DE_NEGOCIO.md §20) - o vendedor decide se valida ou reduz
// sem precisar sair da tela. Modo de edicao inline: so' permite
// REDUZIR quantidade (input com max = quantidade atual, nunca editavel
// pra mais) ou REMOVER o item por completo - nunca aumentar nem
// adicionar item novo (§15.4), reforcado tanto aqui na UI quanto pela
// RPC ajustar_itens_pedido (migration 039), que recusaria mesmo que a
// UI deixasse passar.
export function PedidoItensSection({ pedido }: { pedido: PedidoDetalhe }) {
  const [editando, setEditando] = useState(false)
  const [itens, setItens] = useState<ItemEdit[]>(() => estadoInicial(pedido))
  const ajustar = useAjustarPedido()

  const podeEditar = pedido.pode_gerenciar && pedido.status === 'aguardando_validacao'

  function atualizarItem(variantId: string, patch: Partial<ItemEdit>) {
    setItens((prev) => prev.map((i) => (i.variant_id === variantId ? { ...i, ...patch } : i)))
  }

  function iniciarEdicao() {
    setItens(estadoInicial(pedido))
    setEditando(true)
  }

  function cancelarEdicao() {
    setItens(estadoInicial(pedido))
    setEditando(false)
  }

  function totalEditado() {
    return pedido.itens.reduce((soma, item) => {
      const edit = itens.find((i) => i.variant_id === item.variant_id)
      if (!edit || edit.removido) return soma
      return soma + item.preco_unitario * edit.quantidade
    }, 0)
  }

  function salvar() {
    const payload = itens
      .filter((i) => !i.removido)
      .map((i) => ({ variant_id: i.variant_id, quantidade: i.quantidade }))

    ajustar.mutate({ id: pedido.id, itens: payload }, { onSuccess: () => setEditando(false) })
  }

  const restantes = itens.filter((i) => !i.removido).length

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Itens</h2>
        {podeEditar && !editando && (
          <Button type="button" variant="outline" size="sm" onClick={iniciarEdicao}>
            <PencilIcon className="size-3.5" />
            Editar
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Estoque disponível</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {editando && <TableHead className="text-right">Remover</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedido.itens.map((item) => {
              const edit = itens.find((i) => i.variant_id === item.variant_id)
              const quantidadeAtual = edit?.quantidade ?? item.quantidade
              const estoqueInsuficiente = item.saldo_estoque < item.quantidade

              if (editando && edit?.removido) {
                return (
                  <TableRow key={item.variant_id} className="opacity-60">
                    <TableCell colSpan={4} className="text-sm text-muted-foreground line-through">
                      {item.produto_nome}
                      {item.variacao_nome && item.variacao_nome !== 'Padrão' ? ` (${item.variacao_nome})` : ''}
                      {' '}— removido
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => atualizarItem(item.variant_id, { removido: false })}
                        aria-label="Desfazer remoção"
                      >
                        <RotateCcwIcon className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              }

              return (
                <TableRow key={item.variant_id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{item.produto_nome}</p>
                    {item.variacao_nome && item.variacao_nome !== 'Padrão' && (
                      <p className="text-xs text-muted-foreground">{item.variacao_nome}</p>
                    )}
                  </TableCell>
                  <TableCell className={cn(estoqueInsuficiente && 'font-medium text-destructive')}>
                    {item.saldo_estoque} unidade(s)
                    {estoqueInsuficiente && ' — insuficiente'}
                  </TableCell>
                  <TableCell className="text-right">{formatarMoeda(item.preco_unitario)}</TableCell>
                  <TableCell className="text-right">
                    {editando ? (
                      <Input
                        type="number"
                        min={1}
                        max={item.quantidade}
                        value={quantidadeAtual}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(item.quantidade, Number(e.target.value) || 1))
                          atualizarItem(item.variant_id, { quantidade: v })
                        }}
                        className="ml-auto w-20 text-right"
                      />
                    ) : (
                      item.quantidade
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatarMoeda(item.preco_unitario * quantidadeAtual)}
                  </TableCell>
                  {editando && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => atualizarItem(item.variant_id, { removido: true })}
                        aria-label="Remover item"
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="font-display text-lg font-extrabold text-foreground">
          {formatarMoeda(editando ? totalEditado() : pedido.total)}
        </span>
      </div>

      {editando && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:bg-amber-950 dark:text-amber-400">
          <p>
            {restantes === 0
              ? 'Não é possível remover todos os itens por aqui — cancele o pedido em vez disso.'
              : 'O cliente será notificado desta alteração assim que você salvar.'}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancelarEdicao} disabled={ajustar.isPending}>
              Cancelar edição
            </Button>
            <Button type="button" size="sm" onClick={salvar} disabled={ajustar.isPending || restantes === 0}>
              {ajustar.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
