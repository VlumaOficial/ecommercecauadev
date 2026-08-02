'use client'

import { ArrowRightLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useHistoricoEstoque, type ItemEstoque, type TipoMovimentacao } from '@/hooks/use-estoque'

const ROTULO_TIPO: Record<TipoMovimentacao, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  inventario: 'Inventário',
  devolucao: 'Devolução',
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function HistoricoDialog({
  open,
  onOpenChange,
  item,
  onMovimentar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ItemEstoque | null
  onMovimentar: () => void
}) {
  const { data: movimentos = [], isLoading } = useHistoricoEstoque(open && item ? item.id : null)

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {item.produto_nome} — {item.variacao_nome}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="mb-3 text-sm text-muted-foreground">
            Saldo atual: <span className="font-medium text-foreground">{item.saldo_estoque}</span>
          </p>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : movimentos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Data</th>
                    <th className="px-3 py-1.5 text-left font-medium">Tipo</th>
                    <th className="px-3 py-1.5 text-right font-medium">Quantidade</th>
                    <th className="px-3 py-1.5 text-right font-medium">Saldo</th>
                    <th className="px-3 py-1.5 text-left font-medium">Motivo</th>
                    <th className="px-3 py-1.5 text-left font-medium">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentos.map((m) => (
                    <tr key={m.id} className="border-t border-border align-top">
                      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                        {formatarData(m.created_at)}
                      </td>
                      <td className="px-3 py-1.5">{ROTULO_TIPO[m.tipo]}</td>
                      <td
                        className={`px-3 py-1.5 text-right font-medium ${
                          m.quantidade > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-destructive'
                        }`}
                      >
                        {m.quantidade > 0 ? '+' : ''}
                        {m.quantidade}
                      </td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">
                        {m.saldo_anterior} → {m.saldo_novo}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{m.motivo ?? '—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{m.usuario_nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={onMovimentar}>
            <ArrowRightLeftIcon />
            Registrar movimentação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
