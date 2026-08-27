'use client'

import { useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  useNotificacoesPedido,
  useSalvarNotificacoesPedido,
  type NotificacaoPedidoStaff,
} from '@/hooks/use-notificacoes-pedido'

// Melhoria de notificação (c), REGRAS_DE_NEGOCIO.md §18.6c — card que
// escolhe QUEM da equipe recebe o aviso de "pedido novo" e por qual
// canal. Renderizado ABAIXO do form de Configurações (item 4), com
// fluxo/save PRÓPRIOS — não compartilha estado nem submit com aquele form.

function linhaInvalida(l: NotificacaoPedidoStaff) {
  // "Recebe" ligado sem canal nenhum é inválido (espelha o CHECK
  // onr_ativo_exige_canal do banco). WhatsApp marcado sem número também
  // (mas a UI já impede via `disabled`, então isto é defensivo).
  if (l.ativo && !l.canal_email && !l.canal_whatsapp) return true
  if (l.canal_whatsapp && !l.tem_whatsapp) return true
  return false
}

export function NotificacoesPedidoCard() {
  const { data, isLoading, isError } = useNotificacoesPedido()
  const salvar = useSalvarNotificacoesPedido()

  // Estado local editável, re-semeado quando a query traz uma lista nova
  // (ex.: depois de salvar e invalidar). Padrão "ajustar estado no render"
  // recomendado pelo React em vez de sincronizar por useEffect — a
  // referência de `data.lista` é estável entre renders (react-query),
  // então o reset só dispara quando os dados realmente mudam.
  const listaServidor = data && !data.restrito ? data.lista : null
  const [linhas, setLinhas] = useState<NotificacaoPedidoStaff[]>([])
  const [listaAnterior, setListaAnterior] = useState<NotificacaoPedidoStaff[] | null>(null)
  if (listaServidor !== listaAnterior) {
    setListaAnterior(listaServidor)
    setLinhas(listaServidor ?? [])
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notificações — aviso de novo pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Carregando...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notificações — aviso de novo pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-sm text-destructive">
            Não foi possível carregar as configurações de notificação.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (data?.restrito) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notificações — aviso de novo pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-sm text-muted-foreground">
            Apenas administradores podem configurar quem recebe o aviso de novo pedido.
          </p>
        </CardContent>
      </Card>
    )
  }

  function atualizar(profileId: string, patch: Partial<NotificacaoPedidoStaff>) {
    setLinhas((atual) =>
      atual.map((l) => {
        if (l.profile_id !== profileId) return l
        const nova = { ...l, ...patch }
        // Desligar "recebe" zera os canais (não deixa flag órfã).
        if (!nova.ativo) {
          nova.canal_email = false
          nova.canal_whatsapp = false
        }
        return nova
      })
    )
  }

  const algumaInvalida = linhas.some(linhaInvalida)

  function onSalvar() {
    if (algumaInvalida) {
      toast.error('Há destinatários ativos sem canal escolhido. Escolha ao menos um canal ou desligue o aviso.')
      return
    }
    salvar.mutate(
      linhas.map((l) => ({
        profile_id: l.profile_id,
        ativo: l.ativo,
        canal_email: l.canal_email,
        canal_whatsapp: l.canal_whatsapp,
      }))
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificações — aviso de novo pedido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escolha quais membros da equipe recebem um aviso quando um cliente finaliza um pedido, e por
          qual canal. É diferente das notificações enviadas ao cliente.
        </p>

        {linhas.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhum membro da equipe ativo.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {linhas.map((l) => {
              const invalida = linhaInvalida(l)
              return (
                <li key={l.profile_id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{l.nome}</p>
                    {l.ativo && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <Label className="flex items-center gap-2 text-sm font-normal">
                          <Checkbox
                            checked={l.canal_email}
                            onCheckedChange={(v) => atualizar(l.profile_id, { canal_email: v === true })}
                          />
                          E-mail
                        </Label>
                        <Label
                          className="flex items-center gap-2 text-sm font-normal data-[disabled]:opacity-60"
                          data-disabled={!l.tem_whatsapp ? '' : undefined}
                        >
                          <Checkbox
                            checked={l.canal_whatsapp}
                            disabled={!l.tem_whatsapp}
                            onCheckedChange={(v) => atualizar(l.profile_id, { canal_whatsapp: v === true })}
                          />
                          WhatsApp
                        </Label>
                        {!l.tem_whatsapp && (
                          <span className="text-xs text-muted-foreground">
                            Cadastre o WhatsApp na tela de Equipe para habilitar.
                          </span>
                        )}
                        {invalida && (
                          <span className="text-xs text-destructive">Escolha ao menos um canal.</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">Recebe aviso</span>
                    <Switch
                      checked={l.ativo}
                      onCheckedChange={(v) => atualizar(l.profile_id, { ativo: v === true })}
                      aria-label={`Aviso de novo pedido para ${l.nome}`}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={onSalvar} disabled={salvar.isPending || algumaInvalida}>
            {salvar.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
