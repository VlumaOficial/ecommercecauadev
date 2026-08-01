'use client'

import { useEffect, useMemo } from 'react'
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
import { useUnidadesVendaAtivas } from '@/hooks/use-unidades-venda'
import { getPath } from '@/lib/category-tree'
import type { ProdutoFormValues } from '@/hooks/use-produtos'

type CategoriaOption = { value: string; label: string }
type UnidadeOption = { value: string; label: string }

export function ProdutoDadosBasicos() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<ProdutoFormValues>()

  const { data: categorias = [] } = useCategorias()
  const { data: unidadesVenda = [] } = useUnidadesVendaAtivas()

  const opcoesCategoria = useMemo<CategoriaOption[]>(() => {
    return categorias
      .filter((c) => c.ativo)
      .map((c) => ({ value: c.id, label: getPath(c.id, categorias) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [categorias])

  const opcoesUnidade = useMemo<UnidadeOption[]>(() => {
    return unidadesVenda
      .map((u) => ({ value: u.id, label: u.nome }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [unidadesVenda])

  const unidadeVendaId = useWatch({ control, name: 'unidade_venda_id' })

  // So em produto NOVO (campo ainda vazio): assim que a lista carrega,
  // pre-seleciona "Unidade" (valor default do cadastro, migration 019)
  // pra nao obrigar o lojista a escolher toda vez no caso mais comum.
  // Em edicao o valor ja vem preenchido do produto - nunca sobrescreve.
  useEffect(() => {
    if (unidadeVendaId || unidadesVenda.length === 0) return
    const padrao = unidadesVenda.find((u) => u.nome === 'Unidade') ?? unidadesVenda[0]
    if (padrao) setValue('unidade_venda_id', padrao.id)
  }, [unidadeVendaId, unidadesVenda, setValue])

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
          <Label htmlFor="produto-unidade">Unidade de venda *</Label>
          <Controller
            control={control}
            name="unidade_venda_id"
            render={({ field }) => {
              const selecionada = opcoesUnidade.find((o) => o.value === field.value) ?? null
              return (
                <Combobox
                  items={opcoesUnidade}
                  value={selecionada}
                  onValueChange={(item: UnidadeOption | null) => field.onChange(item ? item.value : '')}
                >
                  <ComboboxInputGroup>
                    <ComboboxInput id="produto-unidade" placeholder="Selecione a unidade" />
                    <ComboboxClear />
                    <ComboboxTrigger />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    {(item: UnidadeOption) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxContent>
                </Combobox>
              )
            }}
          />
          {errors.unidade_venda_id && (
            <p className="text-xs text-destructive">{errors.unidade_venda_id.message}</p>
          )}
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
