'use client'

import { PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import { useProduto, type Produto } from '@/hooks/use-produtos'
import { useUnidadesVenda } from '@/hooks/use-unidades-venda'
import { formatarMoeda } from '@/lib/utils'

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium text-muted-foreground">{rotulo}</div>
      <div className="text-sm text-foreground">{valor}</div>
    </div>
  )
}

export function ProdutoViewDialog({
  open,
  onOpenChange,
  produto,
  onEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: Produto | null
  onEdit: () => void
}) {
  // So busca o detalhe (variacoes) quando o dialog esta de fato aberto
  // com um produto - useProduto ja tem enabled: !!id internamente.
  const { data: detalhe, isLoading } = useProduto(open && produto?.id ? produto.id : '')
  // Lista completa (nao so ativas) pra sempre conseguir mostrar o nome
  // da unidade, mesmo que tenha sido inativada depois de usada aqui.
  const { data: unidades = [] } = useUnidadesVenda({ status: 'todos', busca: '' })

  if (!produto) return null

  const nomeUnidade = unidades.find((u) => u.id === produto.unidade_venda_id)?.nome ?? '—'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{produto.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge ativo={!!produto.ativo} />
            {produto.esgotado && <Badge variant="secondary">Esgotado</Badge>}
            {produto.em_promocao && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
              >
                Promoção
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Código" valor={produto.codigo ?? '—'} />
            <Campo rotulo="Categoria" valor={produto.categoria_nome ?? '—'} />
            <Campo rotulo="Unidade de venda" valor={nomeUnidade} />
            <Campo rotulo="Preço a partir de" valor={formatarMoeda(produto.preco_a_partir_de)} />
          </div>

          <Campo
            rotulo="Descrição"
            valor={produto.descricao?.trim() ? produto.descricao : 'Sem descrição'}
          />

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Variações</div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Nome</th>
                      <th className="px-3 py-1.5 text-left font-medium">SKU</th>
                      <th className="px-3 py-1.5 text-right font-medium">Preço</th>
                      <th className="px-3 py-1.5 text-right font-medium">Estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detalhe?.variacoes ?? []).map((v) => (
                      <tr key={v.id} className="border-t border-border">
                        <td className="px-3 py-1.5">{v.nome}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{v.sku ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right">{formatarMoeda(v.preco)}</td>
                        <td className="px-3 py-1.5 text-right">
                          {v.modo_estoque === 'quantitativo' ? v.saldo_estoque : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={onEdit}>
            <PencilIcon />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
