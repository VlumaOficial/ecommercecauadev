'use client'

import { Controller, FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useSalvarConfiguracoes } from '@/hooks/use-configuracoes'
import type { ConfiguracoesCampos } from '@/lib/configuracoes/types'

// Vazio (CurrencyInput comeca sem digitar nada) equivale a R$0,00 -
// diferente do preco de produto, aqui 0 e' um valor valido (so' o
// flag valor_minimo_pedido_habilitado decide se a regra vale de
// verdade, REGRAS_DE_NEGOCIO.md §11.4).
const numeroOuVazio = z.union([z.literal(''), z.coerce.number()])

const configuracoesSchema = z
  .object({
    loja_aberta: z.boolean(),
    mensagem_loja_fechada: z.string().trim().min(1, 'Informe a mensagem de loja fechada.'),
    pedidos_abertos: z.boolean(),
    mensagem_pedidos_fechados: z.string().trim().min(1, 'Informe a mensagem de pedidos fechados.'),
    permite_autocadastro: z.boolean(),
    valor_minimo_pedido_habilitado: z.boolean(),
    valor_minimo_pedido: numeroOuVazio,
    cancelamento_automatico_habilitado: z.boolean(),
    prazo_cancelamento_automatico_horas: z.coerce
      .number()
      .int('Use um número inteiro de horas.')
      .positive('O prazo deve ser maior que zero.'),
  })
  .refine((v) => v.valor_minimo_pedido === '' || v.valor_minimo_pedido >= 0, {
    message: 'Informe um valor válido.',
    path: ['valor_minimo_pedido'],
  })

type ConfiguracoesFormInput = z.input<typeof configuracoesSchema>
type ConfiguracoesFormOutput = z.output<typeof configuracoesSchema>

function paraFormulario(campos: ConfiguracoesCampos): ConfiguracoesFormInput {
  return { ...campos }
}

function paraPayload(valores: ConfiguracoesFormOutput): ConfiguracoesCampos {
  return {
    ...valores,
    valor_minimo_pedido: valores.valor_minimo_pedido === '' ? 0 : valores.valor_minimo_pedido,
  }
}

export function ConfiguracoesForm({ valoresIniciais }: { valoresIniciais: ConfiguracoesCampos }) {
  const methods = useForm<
    z.input<typeof configuracoesSchema>,
    unknown,
    z.output<typeof configuracoesSchema>
  >({
    resolver: zodResolver(configuracoesSchema),
    defaultValues: paraFormulario(valoresIniciais),
  })
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = methods

  const salvar = useSalvarConfiguracoes()

  async function onSalvar(valores: ConfiguracoesFormOutput) {
    await salvar.mutateAsync(paraPayload(valores))
  }

  return (
    <FormProvider {...methods}>
      <form className="space-y-6 pb-24" onSubmit={(e) => e.preventDefault()}>
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Configurações</h1>
          <p className="mt-1 text-muted-foreground">Regras gerais de funcionamento da loja.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Status da loja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="loja-aberta">Loja aberta</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desligado, o cliente só vê a mensagem abaixo. Nem o catálogo aparece.
                </p>
              </div>
              <Controller
                control={control}
                name="loja_aberta"
                render={({ field }) => (
                  <Switch id="loja-aberta" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mensagem-loja-fechada">Mensagem de loja fechada</Label>
              <Textarea
                id="mensagem-loja-fechada"
                rows={2}
                aria-invalid={!!errors.mensagem_loja_fechada}
                {...register('mensagem_loja_fechada')}
              />
              {errors.mensagem_loja_fechada && (
                <p className="text-xs text-destructive">{errors.mensagem_loja_fechada.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="pedidos-abertos">Pedidos abertos</Label>
                <p className="text-xs text-muted-foreground">
                  Com a loja aberta, desligar isto mantém o catálogo visível mas bloqueia adicionar itens ao carrinho.
                </p>
              </div>
              <Controller
                control={control}
                name="pedidos_abertos"
                render={({ field }) => (
                  <Switch id="pedidos-abertos" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mensagem-pedidos-fechados">Mensagem de pedidos fechados</Label>
              <Textarea
                id="mensagem-pedidos-fechados"
                rows={2}
                aria-invalid={!!errors.mensagem_pedidos_fechados}
                {...register('mensagem_pedidos_fechados')}
              />
              {errors.mensagem_pedidos_fechados && (
                <p className="text-xs text-destructive">{errors.mensagem_pedidos_fechados.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="permite-autocadastro">Permitir autocadastro</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desligado, a tela de cadastro fica fechada para novos clientes.
                </p>
              </div>
              <Controller
                control={control}
                name="permite_autocadastro"
                render={({ field }) => (
                  <Switch id="permite-autocadastro" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedido mínimo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="valor-minimo-habilitado">Exigir valor mínimo de pedido</Label>
                <p className="text-xs text-muted-foreground">
                  Só quando ligado é que o valor abaixo é considerado no carrinho.
                </p>
              </div>
              <Controller
                control={control}
                name="valor_minimo_pedido_habilitado"
                render={({ field }) => (
                  <Switch
                    id="valor-minimo-habilitado"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor-minimo-pedido">Valor mínimo</Label>
              <Controller
                control={control}
                name="valor_minimo_pedido"
                render={({ field }) => (
                  <CurrencyInput
                    id="valor-minimo-pedido"
                    aria-invalid={!!errors.valor_minimo_pedido}
                    // z.coerce.number() no schema faz o input type
                    // inferido virar `unknown` (z.input) - o runtime
                    // e' sempre number | '' (mesmo formato que
                    // CurrencyInput sempre recebeu/emitiu, igual ao
                    // preco de variacao em produto-form.tsx).
                    value={field.value as number | ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              {errors.valor_minimo_pedido && (
                <p className="text-xs text-destructive">{errors.valor_minimo_pedido.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancelamento automático</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="cancelamento-automatico">Cancelamento automático</Label>
                <p className="text-xs text-muted-foreground">
                  Pedidos aguardando validação por mais tempo que o prazo abaixo são cancelados sozinhos.
                </p>
              </div>
              <Controller
                control={control}
                name="cancelamento_automatico_habilitado"
                render={({ field }) => (
                  <Switch
                    id="cancelamento-automatico"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prazo-cancelamento">Prazo (horas)</Label>
              <Input
                id="prazo-cancelamento"
                type="number"
                aria-invalid={!!errors.prazo_cancelamento_automatico_horas}
                {...register('prazo_cancelamento_automatico_horas')}
              />
              {errors.prazo_cancelamento_automatico_horas && (
                <p className="text-xs text-destructive">{errors.prazo_cancelamento_automatico_horas.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-[#f6f8fb]/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Button type="button" disabled={salvar.isPending} onClick={handleSubmit(onSalvar)}>
              Salvar
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
