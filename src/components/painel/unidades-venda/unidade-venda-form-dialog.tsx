'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormDialog } from '@/components/painel/crud/form-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { UnidadeVenda, UnidadeVendaFormValues } from '@/hooks/use-unidades-venda'

const unidadeSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da unidade.'),
  ativo: z.boolean(),
})

const VALORES_PADRAO: UnidadeVendaFormValues = {
  nome: '',
  ativo: true,
}

export function UnidadeVendaFormDialog({
  open,
  onOpenChange,
  unidade,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  unidade: UnidadeVenda | null
  onSubmit: (values: UnidadeVendaFormValues) => void
  loading: boolean
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UnidadeVendaFormValues>({
    resolver: zodResolver(unidadeSchema),
    defaultValues: VALORES_PADRAO,
  })

  useEffect(() => {
    if (!open) return
    reset(unidade ? { nome: unidade.nome, ativo: unidade.ativo } : VALORES_PADRAO)
  }, [open, unidade, reset])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={unidade ? 'Editar unidade de venda' : 'Adicionar unidade de venda'}
      description="Unidades de venda ficam disponiveis no cadastro de produtos (ex.: Unidade, Kg, Litro)."
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={unidade ? 'Salvar alterações' : 'Adicionar unidade'}
      loading={loading}
    >
      <div className="space-y-1.5">
        <Label htmlFor="unidade-nome">Nome *</Label>
        <Input
          id="unidade-nome"
          placeholder="Ex.: Dúzia"
          aria-invalid={!!errors.nome}
          {...register('nome')}
        />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <Label htmlFor="unidade-ativo">Unidade ativa</Label>
        <Controller
          control={control}
          name="ativo"
          render={({ field }) => (
            <Switch id="unidade-ativo" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>
    </FormDialog>
  )
}
