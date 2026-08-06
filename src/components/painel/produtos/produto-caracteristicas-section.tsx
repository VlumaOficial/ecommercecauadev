'use client'

import { Controller, useFormContext } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import type { Caracteristica } from '@/hooks/use-caracteristicas'
import type { ProdutoFormValues } from '@/hooks/use-produtos'

type OpcaoSelecao = { value: string; label: string }

// Um campo por caracteristica ATIVA da categoria - tipo determina o
// controle renderizado. "obrigatorio" e validado no ProdutoForm (pai),
// nao aqui: o form usa zodResolver, que ignora as regras nativas do
// register/Controller (validate/rules) - fonte unica de erros vem de
// methods.setError no onSubmit do pai, lido aqui via errors.caracteristicas.
//
// "ativas" vem PRONTA do pai (ProdutoForm), nao e buscada aqui de novo -
// de proposito: o pai usa a MESMA lista pra montar o payload do submit
// (onSubmit) e pra validar obrigatoriedade. Ter duas chamadas separadas
// de useCaracteristicas (uma aqui, outra no pai) sujeitava as duas a
// resolverem/rerenderizarem em momentos ligeiramente diferentes (mesmo
// compartilhando cache do React Query) - risco real observado em teste:
// o form as vezes submetia com a lista do pai ainda vazia, mesmo com os
// campos ja renderizados na tela (lista do filho ja preenchida). Uma
// unica fonte elimina essa janela de inconsistencia.
export function ProdutoCaracteristicasSection({
  categoryId,
  ativas,
  carregando,
}: {
  categoryId: string
  ativas: Caracteristica[]
  carregando: boolean
}) {
  const { register, control, formState: { errors } } = useFormContext<ProdutoFormValues>()

  const caracteristicasErrors = errors.caracteristicas as
    | Record<string, { message?: string } | undefined>
    | undefined

  if (!categoryId || carregando || ativas.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Características</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ficha técnica da categoria selecionada — preencha o que for relevante para este produto.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {ativas.map((attr) => {
          const path = `caracteristicas.${attr.id}` as const
          const erro = caracteristicasErrors?.[attr.id]
          const rotulo = attr.obrigatorio ? `${attr.rotulo} *` : attr.rotulo

          if (attr.tipo === 'booleano') {
            return (
              <div
                key={attr.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
              >
                <Label htmlFor={path}>{rotulo}</Label>
                <Controller
                  control={control}
                  name={path}
                  render={({ field }) => (
                    <Switch
                      id={path}
                      checked={field.value === 'true'}
                      onCheckedChange={(checked) => field.onChange(checked ? 'true' : 'false')}
                    />
                  )}
                />
              </div>
            )
          }

          if (attr.tipo === 'selecao') {
            const opcoes: OpcaoSelecao[] = (attr.opcoes ?? []).map((o) => ({ value: o, label: o }))
            return (
              <div key={attr.id} className="space-y-1.5">
                <Label htmlFor={path}>{rotulo}</Label>
                <Controller
                  control={control}
                  name={path}
                  render={({ field }) => {
                    const selecionada = opcoes.find((o) => o.value === field.value) ?? null
                    return (
                      <Combobox
                        items={opcoes}
                        value={selecionada}
                        onValueChange={(item: OpcaoSelecao | null) => field.onChange(item ? item.value : '')}
                      >
                        <ComboboxInputGroup>
                          <ComboboxInput id={path} placeholder="Selecione" />
                          <ComboboxClear />
                          <ComboboxTrigger />
                        </ComboboxInputGroup>
                        <ComboboxContent>
                          {(item: OpcaoSelecao) => (
                            <ComboboxItem key={item.value} value={item}>
                              {item.label}
                            </ComboboxItem>
                          )}
                        </ComboboxContent>
                      </Combobox>
                    )
                  }}
                />
                {erro && <p className="text-xs text-destructive">{erro.message}</p>}
              </div>
            )
          }

          return (
            <div key={attr.id} className="space-y-1.5">
              <Label htmlFor={path}>{rotulo}</Label>
              <Input
                id={path}
                type={attr.tipo === 'numero' ? 'number' : 'text'}
                aria-invalid={!!erro}
                {...register(path)}
              />
              {erro && <p className="text-xs text-destructive">{erro.message}</p>}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
