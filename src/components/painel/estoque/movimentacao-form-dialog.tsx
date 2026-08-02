'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormDialog } from '@/components/painel/crud/form-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ItemEstoque, MovimentacaoFormValues } from '@/hooks/use-estoque'

const TIPOS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'devolucao', label: 'Devolução' },
] as const

// "inventario" nao aparece aqui de proposito - reservado ao sistema
// (estoque inicial no cadastro do produto). Ver ESCOPO_PROJETO.md,
// modulo de Estoque.
const formSchema = z
  .object({
    tipo: z.enum(['entrada', 'saida', 'ajuste', 'devolucao']),
    quantidade: z.union([z.literal(''), z.coerce.number().positive('Informe uma quantidade maior que zero.')]),
    saldo_novo_desejado: z.union([z.literal(''), z.coerce.number().min(0, 'O saldo não pode ser negativo.')]),
    motivo: z.string().trim(),
  })
  .refine((v) => v.tipo === 'ajuste' || v.quantidade !== '', {
    message: 'Informe a quantidade movimentada.',
    path: ['quantidade'],
  })
  .refine((v) => v.tipo !== 'ajuste' || v.saldo_novo_desejado !== '', {
    message: 'Informe o novo saldo total.',
    path: ['saldo_novo_desejado'],
  })
  .refine((v) => v.tipo !== 'ajuste' || v.motivo.length > 0, {
    message: 'Informe o motivo do ajuste.',
    path: ['motivo'],
  })

type FormValues = z.input<typeof formSchema>

const VALORES_PADRAO: FormValues = {
  tipo: 'entrada',
  quantidade: '',
  saldo_novo_desejado: '',
  motivo: '',
}

export function MovimentacaoFormDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ItemEstoque | null
  onSubmit: (values: MovimentacaoFormValues) => void
  loading: boolean
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: VALORES_PADRAO,
  })

  const tipo = useWatch({ control, name: 'tipo' })

  useEffect(() => {
    if (!open) return
    reset(VALORES_PADRAO)
  }, [open, item, reset])

  function handleFormSubmit(values: FormValues) {
    if (!item) return
    if (values.tipo === 'ajuste') {
      onSubmit({
        variant_id: item.id,
        tipo: 'ajuste',
        saldo_novo_desejado: Number(values.saldo_novo_desejado),
        motivo: values.motivo,
      })
    } else {
      const sinal = values.tipo === 'saida' ? -1 : 1
      onSubmit({
        variant_id: item.id,
        tipo: values.tipo,
        quantidade: sinal * Number(values.quantidade),
        motivo: values.motivo,
      })
    }
  }

  if (!item) return null

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar movimentação"
      description={`${item.produto_nome} — ${item.variacao_nome} (saldo atual: ${item.saldo_estoque})`}
      onSubmit={handleSubmit(handleFormSubmit)}
      submitLabel="Registrar"
      loading={loading}
    >
      <div className="space-y-1.5">
        <Label htmlFor="movimentacao-tipo">Tipo *</Label>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="movimentacao-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {tipo === 'ajuste' ? (
        <div className="space-y-1.5">
          <Label htmlFor="movimentacao-saldo-novo">Novo saldo total *</Label>
          <Input
            id="movimentacao-saldo-novo"
            type="number"
            min="0"
            aria-invalid={!!errors.saldo_novo_desejado}
            {...register('saldo_novo_desejado')}
          />
          <p className="text-xs text-muted-foreground">
            Informe o saldo real após a contagem — o sistema calcula a diferença sozinho.
          </p>
          {errors.saldo_novo_desejado && (
            <p className="text-xs text-destructive">{errors.saldo_novo_desejado.message}</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="movimentacao-quantidade">Quantidade *</Label>
          <Input
            id="movimentacao-quantidade"
            type="number"
            min="0"
            aria-invalid={!!errors.quantidade}
            {...register('quantidade')}
          />
          {errors.quantidade && <p className="text-xs text-destructive">{errors.quantidade.message}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="movimentacao-motivo">
          Motivo{tipo === 'ajuste' ? ' *' : ''}
        </Label>
        <Textarea id="movimentacao-motivo" rows={2} {...register('motivo')} />
        {errors.motivo && <p className="text-xs text-destructive">{errors.motivo.message}</p>}
      </div>
    </FormDialog>
  )
}
