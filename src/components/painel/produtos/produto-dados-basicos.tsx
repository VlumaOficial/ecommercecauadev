'use client'

import { useMemo } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { useCategorias } from '@/hooks/use-categorias'
import { getPath } from '@/lib/category-tree'
import type { ProdutoFormValues } from '@/hooks/use-produtos'

type CategoriaOption = { value: string; label: string }

export function ProdutoDadosBasicos() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProdutoFormValues>()

  const { data: categorias = [] } = useCategorias()

  const opcoesCategoria = useMemo<CategoriaOption[]>(() => {
    return categorias
      .filter((c) => c.ativo)
      .map((c) => ({ value: c.id, label: getPath(c.id, categorias) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [categorias])

  const ativo = useWatch({ control, name: 'ativo' })
  const destaque = useWatch({ control, name: 'destaque' })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados básicos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="produto-nome">Nome *</Label>
          <Input
            id="produto-nome"
            placeholder="Ex.: Ciclídeo Acará Disco"
            aria-invalid={!!errors.nome}
            {...register('nome')}
          />
          {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="produto-categoria">Categoria *</Label>
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => {
              const selecionada = opcoesCategoria.find((o) => o.value === field.value) ?? null
              return (
                <Combobox
                  items={opcoesCategoria}
                  value={selecionada}
                  onValueChange={(item: CategoriaOption | null) => field.onChange(item ? item.value : '')}
                >
                  <ComboboxInputGroup>
                    <ComboboxInput id="produto-categoria" placeholder="Selecione a categoria" />
                    <ComboboxClear />
                    <ComboboxTrigger />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    {(item: CategoriaOption) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxContent>
                </Combobox>
              )
            }}
          />
          {errors.category_id && (
            <p className="text-xs text-destructive">{errors.category_id.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="produto-descricao">Descrição</Label>
          <Textarea id="produto-descricao" rows={3} {...register('descricao')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="produto-unidade">Unidade de venda</Label>
          <Input id="produto-unidade" placeholder="unidade" {...register('unidade_venda')} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <Label htmlFor="produto-destaque">Produto em destaque</Label>
          <Controller
            control={control}
            name="destaque"
            render={({ field }) => (
              <Switch id="produto-destaque" checked={!!destaque} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <Label htmlFor="produto-ativo">Produto ativo</Label>
          <Controller
            control={control}
            name="ativo"
            render={({ field }) => (
              <Switch id="produto-ativo" checked={!!ativo} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
