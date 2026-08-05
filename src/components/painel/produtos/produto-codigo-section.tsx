'use client'

import { useEffect, useState } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCodigoSugerido } from '@/hooks/use-produtos'
import type { ProdutoFormValues } from '@/hooks/use-produtos'

// Descricao curta de cada modo - complementa o rotulo da aba (curto
// demais pra caber o exemplo inteiro) com o que o lojista precisa
// entender pra escolher entre os 3. Decisao #24.
const DESCRICAO_MODO: Record<'automatico' | 'categoria' | 'manual', string> = {
  automatico: 'Prefixo gerado a partir do nome do produto (ex.: RAFP-0001).',
  categoria: 'Prefixo da categoria selecionada (ex.: RAC-0001) — mesmo modelo de antes.',
  manual: 'Você escolhe o código livremente.',
}

export function ProdutoCodigoSection({ codigoAtual }: { codigoAtual: string | null }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProdutoFormValues>()

  const nome = useWatch({ control, name: 'nome' })
  const categoryId = useWatch({ control, name: 'category_id' })
  const codigoModo = useWatch({ control, name: 'codigo_modo' })
  const codigoVisivel = useWatch({ control, name: 'codigo_visivel' })

  const emEdicao = codigoAtual !== null

  // Debounce do nome pro peek do modo "automatico" - mesmo padrao
  // (400ms) do SearchInput do painel, evita bater na API a cada tecla.
  const [nomeDebounced, setNomeDebounced] = useState(nome)
  useEffect(() => {
    const timer = setTimeout(() => setNomeDebounced(nome), 400)
    return () => clearTimeout(timer)
  }, [nome])

  // So dispara o peek em modo criacao (codigoAtual null) - em edicao o
  // codigo ja existe e e imutavel, nao faz sentido sugerir nada. Cada
  // modo automatico tem seu proprio peek (nome vs. categoria).
  const peekNome = useCodigoSugerido(
    !emEdicao && codigoModo === 'automatico'
      ? { modo: 'nome', nome: nomeDebounced ?? '' }
      : { modo: 'nome', nome: '' }
  )
  const peekCategoria = useCodigoSugerido(
    !emEdicao && codigoModo === 'categoria'
      ? { modo: 'categoria', categoryId: categoryId ?? '' }
      : { modo: 'categoria', categoryId: '' }
  )

  const sugestaoAtiva = codigoModo === 'categoria' ? peekCategoria : peekNome

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
                      <TabsTrigger value="automatico">Automático</TabsTrigger>
                      <TabsTrigger value="categoria" disabled={!categoryId || !!peekCategoria.error}>
                        Herdar da categoria
                      </TabsTrigger>
                      <TabsTrigger value="manual">Manual</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
              <p className="text-xs text-muted-foreground">
                {DESCRICAO_MODO[codigoModo as 'automatico' | 'categoria' | 'manual']}
              </p>
            </div>

            {codigoModo === 'categoria' && !categoryId && (
              <p className="text-xs text-muted-foreground">Selecione uma categoria para ver o código sugerido.</p>
            )}

            {codigoModo === 'categoria' && categoryId && peekCategoria.error && (
              <p className="text-xs text-destructive">{peekCategoria.error.message}</p>
            )}

            {codigoModo === 'automatico' && !nome.trim() && (
              <p className="text-xs text-muted-foreground">Preencha o nome do produto para ver o código sugerido.</p>
            )}

            {codigoModo === 'automatico' && nome.trim() && peekNome.error && (
              <p className="text-xs text-destructive">{peekNome.error.message}</p>
            )}

            {codigoModo === 'manual' ? (
              <div className="space-y-1.5">
                <Label htmlFor="produto-codigo-manual">Código *</Label>
                <Input
                  id="produto-codigo-manual"
                  placeholder={sugestaoAtiva.data?.codigo ?? 'Ex.: CIC-0001'}
                  aria-invalid={!!errors.codigo_manual}
                  {...register('codigo_manual')}
                />
                {errors.codigo_manual && (
                  <p className="text-xs text-destructive">{errors.codigo_manual.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="produto-codigo-preview">Código (gerado automaticamente)</Label>
                <Input
                  id="produto-codigo-preview"
                  value={sugestaoAtiva.isLoading ? 'Calculando...' : sugestaoAtiva.data?.codigo ?? ''}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  O código definitivo é gerado ao salvar — este é só uma prévia.
                </p>
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
