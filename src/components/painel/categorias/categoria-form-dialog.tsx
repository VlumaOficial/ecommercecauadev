'use client'

import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormDialog } from '@/components/painel/crud/form-dialog'
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
import { getDescendantIds, getPath, slugify, type CategoriaNode } from '@/lib/category-tree'
import { derivarPrefixo } from '@/lib/produto-codigo'
import type { Categoria, CategoriaFormValues } from '@/hooks/use-categorias'

const categoriaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da categoria.'),
  slug: z.string().trim().min(1, 'Informe um slug.'),
  parent_id: z.string().nullable(),
  descricao: z.string().trim(),
  ativo: z.boolean(),
  prefixo_codigo: z.string().trim(),
})

const VALORES_PADRAO: CategoriaFormValues = {
  nome: '',
  slug: '',
  parent_id: null,
  descricao: '',
  ativo: true,
  prefixo_codigo: '',
}

function valoresIniciais(categoria: Categoria | null): CategoriaFormValues {
  if (!categoria) return VALORES_PADRAO
  return {
    nome: categoria.nome,
    slug: categoria.slug,
    parent_id: categoria.parent_id,
    descricao: categoria.descricao ?? '',
    ativo: categoria.ativo,
    prefixo_codigo: categoria.prefixo_codigo ?? '',
  }
}

type ParentOption = { value: string; label: string }

export function CategoriaFormDialog({
  open,
  onOpenChange,
  categoria,
  todasCategorias,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoria: Categoria | null
  todasCategorias: CategoriaNode[]
  onSubmit: (values: CategoriaFormValues) => void
  loading: boolean
}) {
  // Inicializados a partir de `categoria` na construcao (nao via efeito
  // assincrono): combinado com o `key={categoria?.id}` no ponto onde
  // este componente e renderizado, cada categoria ganha uma montagem
  // fresca com os valores certos desde o primeiro render — sem isso,
  // useState(false)/defaultValues estaticos ficavam reféns de um
  // reset() em useEffect que corria contra o efeito de auto-slug.
  const [slugManual, setSlugManual] = useState(() => !!categoria)
  // Mesmo raciocinio do slug: prefixo so continua sendo auto-derivado
  // enquanto o lojista nao digitou nada nele proprio (transparencia -
  // decisao #18, nunca caixa-preta).
  const [prefixoManual, setPrefixoManual] = useState(() => !!categoria?.prefixo_codigo)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CategoriaFormValues>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: valoresIniciais(categoria),
  })

  const nome = useWatch({ control, name: 'nome' })

  // So entra em acao ao reabrir o MESMO registro (mesma key, portanto
  // sem remontagem) com dados possivelmente mais recentes — a
  // populacao inicial ja aconteceu via defaultValues/useState acima.
  useEffect(() => {
    if (!open) return
    setSlugManual(!!categoria)
    setPrefixoManual(!!categoria?.prefixo_codigo)
    reset(valoresIniciais(categoria))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || slugManual) return
    setValue('slug', slugify(nome || ''))
  }, [nome, slugManual, open, setValue])

  useEffect(() => {
    if (!open || prefixoManual) return
    setValue('prefixo_codigo', derivarPrefixo(nome || ''))
  }, [nome, prefixoManual, open, setValue])

  // Exclui a propria categoria e toda a sua subarvore das opcoes de
  // pai (validacao anti-ciclo no formulario).
  const opcoesPai = useMemo<ParentOption[]>(() => {
    const excluidos = categoria
      ? new Set([categoria.id, ...getDescendantIds(categoria.id, todasCategorias)])
      : new Set<string>()

    return todasCategorias
      .filter((c) => !excluidos.has(c.id))
      .map((c) => ({ value: c.id, label: getPath(c.id, todasCategorias) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [categoria, todasCategorias])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={categoria ? 'Editar categoria' : 'Nova categoria'}
      description="Categorias organizam o catalogo em arvore, com quantos niveis forem necessarios."
      onSubmit={handleSubmit((values) =>
        // Prefixo so vai pro servidor como "digitado" se o usuario de
        // fato editou o campo (prefixoManual) - senao manda vazio pra
        // deixar o servidor derivar E resolver colisao sozinho (rede
        // de seguranca do auto-sufixo, ver route.ts). Sem isso, o
        // valor pre-preenchido pelo useEffect acima sempre chegava
        // "digitado" no servidor, que nunca tentava o sufixo BET0001
        // em caso de colisao (bug real, achado em produção 01/08/2026).
        onSubmit(prefixoManual ? values : { ...values, prefixo_codigo: '' })
      )}
      submitLabel={categoria ? 'Salvar alteracoes' : 'Criar categoria'}
      loading={loading}
    >
      <div className="space-y-1.5">
        <Label htmlFor="categoria-nome">Nome *</Label>
        <Input
          id="categoria-nome"
          placeholder="Ex.: Racao"
          aria-invalid={!!errors.nome}
          {...register('nome')}
        />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoria-slug">Slug *</Label>
        <Input
          id="categoria-slug"
          placeholder="racao"
          aria-invalid={!!errors.slug}
          {...register('slug', {
            onChange: () => setSlugManual(true),
          })}
        />
        {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoria-prefixo">Prefixo do código</Label>
        <Input
          id="categoria-prefixo"
          placeholder="Ex.: CIC"
          maxLength={10}
          aria-invalid={!!errors.prefixo_codigo}
          {...register('prefixo_codigo', {
            onChange: (e) => {
              setPrefixoManual(true)
              e.target.value = e.target.value.toUpperCase()
            },
          })}
        />
        <p className="text-xs text-muted-foreground">
          Usado no código dos produtos desta categoria (ex.: CIC-0001). Se deixar em branco, é gerado
          automaticamente a partir do nome.
        </p>
        {errors.prefixo_codigo && (
          <p className="text-xs text-destructive">{errors.prefixo_codigo.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoria-pai">Categoria-pai</Label>
        <Controller
          control={control}
          name="parent_id"
          render={({ field }) => {
            const selecionada = opcoesPai.find((o) => o.value === field.value) ?? null
            return (
              <Combobox
                items={opcoesPai}
                value={selecionada}
                onValueChange={(item: ParentOption | null) => field.onChange(item ? item.value : null)}
              >
                <ComboboxInputGroup>
                  <ComboboxInput id="categoria-pai" placeholder="Vazio = categoria raiz" />
                  <ComboboxClear />
                  <ComboboxTrigger />
                </ComboboxInputGroup>
                <ComboboxContent>
                  {(item: ParentOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
            )
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoria-descricao">Descricao</Label>
        <Textarea id="categoria-descricao" rows={3} {...register('descricao')} />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <Label htmlFor="categoria-ativo">Categoria ativa</Label>
        <Controller
          control={control}
          name="ativo"
          render={({ field }) => (
            <Switch id="categoria-ativo" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>
    </FormDialog>
  )
}
