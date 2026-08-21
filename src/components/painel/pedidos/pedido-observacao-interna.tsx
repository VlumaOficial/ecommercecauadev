'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAtualizarObservacaoInterna } from '@/hooks/use-pedidos'

// REGRAS_DE_NEGOCIO.md §19.3/§20: anotacao do vendedor, o cliente
// NUNCA ve este campo - nem a query de /meus-pedidos (migration 037/
// incremento 6) nem nenhuma tela da vitrine selecionam essa coluna. A
// Route Handler (GET /api/painel/pedidos/[id]) so' inclui o valor
// quando pode_gerenciar=true; sem permissao, o campo nem aparece na
// tela (bloco inteiro escondido).
export function PedidoObservacaoInterna({
  pedidoId,
  valorInicial,
  podeGerenciar,
}: {
  pedidoId: string
  valorInicial: string | null
  podeGerenciar: boolean
}) {
  const [valor, setValor] = useState(valorInicial ?? '')
  const [alterado, setAlterado] = useState(false)
  const mutation = useAtualizarObservacaoInterna()

  if (!podeGerenciar) return null

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
        <h2 className="text-sm font-semibold text-foreground">Observação interna</h2>
        <p className="text-xs text-muted-foreground">Só a equipe vê — o cliente nunca tem acesso a este campo.</p>
      </div>

      <Textarea
        value={valor}
        onChange={(e) => {
          setValor(e.target.value)
          setAlterado(true)
        }}
        placeholder="Anotações internas sobre este pedido..."
      />

      {alterado && (
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValor(valorInicial ?? '')
              setAlterado(false)
            }}
            disabled={mutation.isPending}
          >
            Descartar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              mutation.mutate({ id: pedidoId, observacao: valor }, { onSuccess: () => setAlterado(false) })
            }
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar anotação'}
          </Button>
        </div>
      )}
    </div>
  )
}
