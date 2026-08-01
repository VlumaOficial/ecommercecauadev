'use client'

import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCodigoSugerido } from '@/hooks/use-produtos'
import type { ProdutoFormValues } from '@/hooks/use-produtos'

export function ProdutoCodigoSection({ codigoAtual }: { codigoAtual: string | null }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProdutoFormValues>()

  const categoryId = useWatch({ control, name: 'category_id' })
  const codigoModo = useWatch({ control, name: 'codigo_modo' })
  const codigoVisivel = useWatch({ control, name: 'codigo_visivel' })

  // So dispara o peek em modo criacao (codigoAtual null) - em edicao o
  // codigo ja existe e e imutavel, nao faz sentido sugerir nada.
  const { data: sugestao, isLoading, error } = useCodigoSugerido(codigoAtual ? '' : categoryId)
  const semPrefixo = !!error
  const emEdicao = codigoAtual !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Código do produto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {emEdicao ? (
          <div className="space-y-1.5">
            <Label htmlFor="produto-codigo-imutavel">Código</Label>
            <Input id="produto-codigo-imutavel" value={codigoAtual} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              O código não pode ser alterado depois de criado, mesmo que o produto mude de categoria.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Geração do código</Label>
              <Controller
                control={control}
                name="codigo_modo"
                render={({ field }) => (
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList>
                      <TabsTrigger value="automatico" disabled={!categoryId || semPrefixo}>
                        Automático
                      </TabsTrigger>
                      <TabsTrigger value="manual">Manual</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
            </div>

            {!categoryId && (
              <p className="text-xs text-muted-foreground">Selecione uma categoria para ver o código sugerido.</p>
            )}

            {categoryId && error && (
              <p className="text-xs text-destructive">{error.message}</p>
            )}

            {codigoModo === 'automatico' ? (
              <div className="space-y-1.5">
                <Label htmlFor="produto-codigo-preview">Código (gerado automaticamente)</Label>
                <Input
                  id="produto-codigo-preview"
                  value={isLoading ? 'Calculando...' : sugestao?.codigo ?? ''}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  O código definitivo é gerado ao salvar — este é só uma prévia.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="produto-codigo-manual">Código *</Label>
                <Input
                  id="produto-codigo-manual"
                  placeholder={sugestao?.codigo ?? 'Ex.: CIC-0001'}
                  aria-invalid={!!errors.codigo_manual}
                  {...register('codigo_manual')}
                />
                {errors.codigo_manual && (
                  <p className="text-xs text-destructive">{errors.codigo_manual.message}</p>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="produto-codigo-visivel">Código visível na vitrine</Label>
            <p className="text-xs text-muted-foreground">
              Se ligado, o código aparece na página do produto e o cliente pode buscar por ele.
            </p>
          </div>
          <Controller
            control={control}
            name="codigo_visivel"
            render={({ field }) => (
              <Switch
                id="produto-codigo-visivel"
                checked={!!codigoVisivel}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
