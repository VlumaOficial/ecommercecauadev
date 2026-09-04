'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormDialog } from '@/components/painel/crud/form-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Cidade } from '@/hooks/use-cidades'

// Mesma máscara de exibição de staff-form-dialog.tsx/cadastro-form.tsx.
function formatarWhatsapp(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const clienteSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  // Obrigatório para cliente (diferente do WhatsApp de staff) - mesma
  // exigência do cadastro público e da Área do Cliente.
  whatsapp: z.string().trim().refine((v) => {
    const d = v.replace(/\D/g, '')
    return d.length === 10 || d.length === 11
  }, 'Informe um WhatsApp válido com DDD.'),
  delivery_city_id: z.string(),
  observacoes: z.string(),
})

type ClienteFormFields = z.infer<typeof clienteSchema>

const VALORES_PADRAO: ClienteFormFields = {
  nome: '',
  email: '',
  whatsapp: '',
  delivery_city_id: '',
  observacoes: '',
}

export type ClienteParaEditar = {
  id: string
  nome: string
  email: string
  whatsapp: string
  delivery_city_id: string | null
  observacoes: string | null
}

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente,
  cidades,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClienteParaEditar | null
  cidades: Cidade[]
  onSubmit: (values: {
    nome: string
    email: string
    whatsapp: string
    delivery_city_id: string | null
    observacoes: string | null
  }) => void
  loading: boolean
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClienteFormFields>({
    resolver: zodResolver(clienteSchema),
    defaultValues: VALORES_PADRAO,
  })

  useEffect(() => {
    if (!open) return
    reset(
      cliente
        ? {
            nome: cliente.nome,
            email: cliente.email,
            whatsapp: formatarWhatsapp(cliente.whatsapp),
            delivery_city_id: cliente.delivery_city_id ?? '',
            observacoes: cliente.observacoes ?? '',
          }
        : VALORES_PADRAO
    )
  }, [open, cliente, reset])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={cliente ? 'Editar cliente' : 'Adicionar cliente'}
      description={
        cliente
          ? 'Ajuste os dados deste cliente.'
          : 'Um e-mail será enviado para o cliente definir a própria senha.'
      }
      onSubmit={handleSubmit((v) =>
        onSubmit({
          ...v,
          whatsapp: v.whatsapp.replace(/\D/g, ''),
          delivery_city_id: v.delivery_city_id || null,
          observacoes: v.observacoes.trim() || null,
        })
      )}
      submitLabel={cliente ? 'Salvar alterações' : 'Adicionar cliente'}
      loading={loading}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cliente-nome">Nome *</Label>
        <Input id="cliente-nome" placeholder="Nome completo" aria-invalid={!!errors.nome} {...register('nome')} />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cliente-email">E-mail *</Label>
        <Input
          id="cliente-email"
          type="email"
          placeholder="cliente@email.com"
          disabled={!!cliente}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {cliente && <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado aqui.</p>}
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cliente-whatsapp">WhatsApp *</Label>
        <Controller
          control={control}
          name="whatsapp"
          render={({ field }) => (
            <Input
              id="cliente-whatsapp"
              inputMode="tel"
              placeholder="(71) 99999-9999"
              aria-invalid={!!errors.whatsapp}
              value={field.value}
              onChange={(e) => field.onChange(formatarWhatsapp(e.target.value))}
              onBlur={field.onBlur}
            />
          )}
        />
        {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cliente-cidade">Cidade de entrega</Label>
        <Controller
          control={control}
          name="delivery_city_id"
          render={({ field }) => (
            <Select value={field.value || 'sem_cidade'} onValueChange={(v) => field.onChange(v === 'sem_cidade' ? '' : v)}>
              <SelectTrigger id="cliente-cidade" className="w-full">
                <SelectValue placeholder="Sem cidade">
                  {(value: string) => {
                    if (!value || value === 'sem_cidade') return 'Sem cidade'
                    const selecionada = cidades.find((c) => c.id === value)
                    return selecionada ? `${selecionada.nome}${selecionada.uf ? ' - ' + selecionada.uf : ''}` : 'Sem cidade'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_cidade">Sem cidade</SelectItem>
                {cidades.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                    {c.uf ? ` - ${c.uf}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cliente-observacoes">Observações</Label>
        <Textarea id="cliente-observacoes" placeholder="Anotações internas sobre este cliente" {...register('observacoes')} />
      </div>
    </FormDialog>
  )
}
