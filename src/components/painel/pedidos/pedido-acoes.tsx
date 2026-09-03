'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import {
  useValidarPedido,
  useCancelarPedido,
  useConcluirPedido,
  useRemarcarEntrega,
  type PedidoDetalhe,
} from '@/hooks/use-pedidos'

// As acoes de destino do pedido (Validar/Cancelar/Concluir/Remarcar
// entrega) - Editar (reduzir/remover item) mora dentro de
// PedidoItensSection, por mexer diretamente na lista de itens ali.
// Disponibilidade por status (REGRAS_DE_NEGOCIO.md §19.1/§20): Validar
// so' em aguardando_validacao, Concluir so' em confirmado, Cancelar e
// Remarcar entrega em aguardando_validacao OU confirmado (nunca
// terminal). Tudo gated por pode_gerenciar (staff_pode_gerenciar_pedidos,
// migration 039) - as RPCs conferem de novo no servidor, isto e' so' UI.
export function PedidoAcoes({ pedido }: { pedido: PedidoDetalhe }) {
  const [validarAberto, setValidarAberto] = useState(false)
  const [cancelarAberto, setCancelarAberto] = useState(false)
  const [concluirAberto, setConcluirAberto] = useState(false)
  const [remarcarAberto, setRemarcarAberto] = useState(false)
  const [dataPrevista, setDataPrevista] = useState('')
  const [motivo, setMotivo] = useState('')
  const [novaData, setNovaData] = useState('')
  const [motivoRemarca, setMotivoRemarca] = useState('')

  const validar = useValidarPedido()
  const cancelar = useCancelarPedido()
  const concluir = useConcluirPedido()
  const remarcar = useRemarcarEntrega()

  const emAndamento = pedido.status === 'aguardando_validacao' || pedido.status === 'confirmado'
  const podeValidar = pedido.pode_gerenciar && pedido.status === 'aguardando_validacao'
  const podeCancelar = pedido.pode_gerenciar && emAndamento
  const podeConcluir = pedido.pode_gerenciar && pedido.status === 'confirmado'
  const podeRemarcar = pedido.pode_gerenciar && emAndamento

  return (
    <>
      {podeValidar && <Button onClick={() => setValidarAberto(true)}>Validar pedido</Button>}
      {podeConcluir && <Button onClick={() => setConcluirAberto(true)}>Marcar como concluído</Button>}
      {podeRemarcar && (
        <Button variant="outline" onClick={() => setRemarcarAberto(true)}>
          Remarcar entrega
        </Button>
      )}
      {podeCancelar && (
        <Button variant="destructive" onClick={() => setCancelarAberto(true)}>
          Cancelar pedido
        </Button>
      )}

      <Dialog open={validarAberto} onOpenChange={setValidarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validar pedido #{pedido.numero}</DialogTitle>
            <DialogDescription>
              O estoque dos itens será baixado agora. Se algum item não tiver saldo suficiente, a validação
              inteira será recusada — use &quot;Editar&quot; nos itens para reduzir ou remover o item antes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="data-prevista">Data prevista de entrega (opcional)</Label>
            <Input
              id="data-prevista"
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setValidarAberto(false)}
              disabled={validar.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() =>
                validar.mutate(
                  { id: pedido.id, data_prevista: dataPrevista || null },
                  { onSuccess: () => setValidarAberto(false) }
                )
              }
              disabled={validar.isPending}
            >
              {validar.isPending ? 'Aguarde...' : 'Confirmar validação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelarAberto} onOpenChange={setCancelarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pedido #{pedido.numero}</DialogTitle>
            <DialogDescription>
              {pedido.status === 'confirmado'
                ? 'O estoque baixado na validação será devolvido. O cliente será notificado do cancelamento.'
                : 'O cliente será notificado do cancelamento.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-cancelamento">Motivo do cancelamento</Label>
            <Textarea
              id="motivo-cancelamento"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cliente desistiu, item sem estoque..."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelarAberto(false)}
              disabled={cancelar.isPending}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                cancelar.mutate(
                  { id: pedido.id, motivo },
                  {
                    onSuccess: () => {
                      setCancelarAberto(false)
                      setMotivo('')
                    },
                  }
                )
              }
              disabled={cancelar.isPending || !motivo.trim()}
            >
              {cancelar.isPending ? 'Aguarde...' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={remarcarAberto} onOpenChange={setRemarcarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remarcar entrega do pedido #{pedido.numero}</DialogTitle>
            <DialogDescription>
              Define uma nova previsão de entrega. O cliente será notificado da nova data — o motivo é
              interno e não aparece para ele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remarcar-data">Nova data de entrega</Label>
              <Input
                id="remarcar-data"
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarcar-motivo">Motivo da remarcação (interno)</Label>
              <Textarea
                id="remarcar-motivo"
                value={motivoRemarca}
                onChange={(e) => setMotivoRemarca(e.target.value)}
                placeholder="Ex.: transportadora reagendou, cliente pediu para adiar..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemarcarAberto(false)}
              disabled={remarcar.isPending}
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() =>
                remarcar.mutate(
                  { id: pedido.id, data_nova: novaData, motivo: motivoRemarca },
                  {
                    onSuccess: () => {
                      setRemarcarAberto(false)
                      setNovaData('')
                      setMotivoRemarca('')
                    },
                  }
                )
              }
              disabled={remarcar.isPending || !novaData || !motivoRemarca.trim()}
            >
              {remarcar.isPending ? 'Aguarde...' : 'Confirmar remarcação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={concluirAberto}
        onOpenChange={setConcluirAberto}
        title="Marcar pedido como concluído?"
        description="Confirma que a entrega foi realizada. Isso registra a data efetiva de entrega."
        confirmLabel="Concluir"
        loading={concluir.isPending}
        onConfirm={() => concluir.mutate(pedido.id, { onSuccess: () => setConcluirAberto(false) })}
      />
    </>
  )
}
