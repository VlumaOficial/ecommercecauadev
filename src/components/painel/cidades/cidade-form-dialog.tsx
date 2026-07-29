'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormDialog } from '@/components/painel/crud/form-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Cidade, CidadeFormValues } from '@/hooks/use-cidades'

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const cidadeSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da cidade.'),
  uf: z.string().trim().length(2, 'Selecione a UF.'),
  ponto_entrega: z.string().trim(),
  horario: z.string().trim(),
  observacoes: z.string().trim(),
  ativo: z.boolean(),
})

const VALORES_PADRAO: CidadeFormValues = {
  nome: '',
  uf: '',
  ponto_entrega: '',
  horario: '',
  observacoes: '',
  ativo: true,
}

export function CidadeFormDialog({
  open,
  onOpenChange,
  cidade,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cidade: Cidade | null
  onSubmit: (values: CidadeFormValues) => void
  loading: boolean
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CidadeFormValues>({
    resolver: zodResolver(cidadeSchema),
    defaultValues: VALORES_PADRAO,
  })

  useEffect(() => {
    if (!open) return
    reset(
      cidade
        ? {
            nome: cidade.nome,
            uf: cidade.uf ?? '',
            ponto_entrega: cidade.ponto_entrega ?? '',
            horario: cidade.horario ?? '',
            observacoes: cidade.observacoes ?? '',
            ativo: cidade.ativo,
          }
        : VALORES_PADRAO
    )
  }, [open, cidade, reset])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={cidade ? 'Editar cidade' : 'Adicionar cidade'}
      description="Cidades de entrega ficam disponiveis no cadastro e no checkout dos clientes."
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={cidade ? 'Salvar alteracoes' : 'Adicionar cidade'}
      loading={loading}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cidade-nome">Nome *</Label>
        <Input
          id="cidade-nome"
          placeholder="Ex.: Salvador"
          aria-invalid={!!errors.nome}
          {...register('nome')}
        />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cidade-uf">UF *</Label>
        <Controller
          control={control}
          name="uf"
          render={({ field }) => (
            <Select
              value={field.value === '' ? null : field.value}
              onValueChange={(value) => field.onChange(value ?? '')}
            >
              <SelectTrigger id="cidade-uf" className="w-full" aria-invalid={!!errors.uf}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.uf && <p className="text-xs text-destructive">{errors.uf.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cidade-ponto">Ponto de entrega</Label>
        <Input id="cidade-ponto" placeholder="Ex.: Praca da Se" {...register('ponto_entrega')} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cidade-horario">Horario</Label>
        <Input id="cidade-horario" placeholder="Ex.: Sextas, 14h as 18h" {...register('horario')} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cidade-observacoes">Observacoes</Label>
        <Textarea id="cidade-observacoes" rows={3} {...register('observacoes')} />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <Label htmlFor="cidade-ativo">Cidade ativa</Label>
        <Controller
          control={control}
          name="ativo"
          render={({ field }) => (
            <Switch id="cidade-ativo" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>
    </FormDialog>
  )
}
