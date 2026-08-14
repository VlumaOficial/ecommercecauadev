'use client'

import { Controller, useFormContext } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OPCOES_ICONE_SELO } from '@/lib/loja/icones-selo'
import type { ConfiguracaoVitrineCampos } from '@/lib/loja/types'

// Sempre 4 selos fixos (CHECK jsonb_array_length(selos)=4 no banco) -
// sem adicionar/remover, so editar cada um. useFieldArray nao e'
// necessario pra isso (nao ha insert/remove) - so' registrar os 4
// indices direto no form.
export function VitrineSelosSection() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ConfiguracaoVitrineCampos>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selos de confiança</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selo {i + 1}
              </span>
              <Controller
                control={control}
                name={`selos.${i}.ativo`}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`selo-${i}-ativo`} className="text-xs font-normal">
                      Ativo
                    </Label>
                    <Switch id={`selo-${i}-ativo`} checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_140px]">
              <div className="space-y-1">
                <Label htmlFor={`selo-${i}-titulo`} className="text-xs">
                  Título
                </Label>
                <Input
                  id={`selo-${i}-titulo`}
                  aria-invalid={!!errors.selos?.[i]?.titulo}
                  {...register(`selos.${i}.titulo`)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`selo-${i}-subtitulo`} className="text-xs">
                  Subtítulo
                </Label>
                <Input
                  id={`selo-${i}-subtitulo`}
                  aria-invalid={!!errors.selos?.[i]?.subtitulo}
                  {...register(`selos.${i}.subtitulo`)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`selo-${i}-icone`} className="text-xs">
                  Ícone
                </Label>
                <Controller
                  control={control}
                  name={`selos.${i}.icone`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={`selo-${i}-icone`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPCOES_ICONE_SELO.map((op) => (
                          <SelectItem key={op.valor} value={op.valor}>
                            <op.icone className="size-4" />
                            {op.rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
