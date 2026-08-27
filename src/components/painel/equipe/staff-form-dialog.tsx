'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormDialog } from '@/components/painel/crud/form-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { StaffMembro } from '@/hooks/use-equipe'

// Mesma máscara de exibição usada no cadastro/edição de cliente
// (cadastro-form.tsx, conta-form.tsx). O valor guardado no formulário é
// mascarado; vira só dígitos no submit (ver onSubmit abaixo) e o Route
// Handler ainda re-normaliza (whatsappOpcional).
function formatarWhatsapp(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const staffSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  // Opcional: vazio é válido (staff sem WhatsApp só recebe aviso por
  // e-mail). Se preenchido, exige DDD + número (10 ou 11 dígitos).
  whatsapp: z.string().trim().refine((v) => {
    const d = v.replace(/\D/g, '')
    return d === '' || d.length === 10 || d.length === 11
  }, 'Informe um WhatsApp válido com DDD ou deixe em branco.'),
  role: z.enum(['admin', 'operador']),
  pode_aceitar_pedido: z.boolean(),
})

type StaffFormValues = z.infer<typeof staffSchema>

const VALORES_PADRAO: StaffFormValues = {
  nome: '',
  email: '',
  whatsapp: '',
  role: 'operador',
  pode_aceitar_pedido: false,
}

export function StaffFormDialog({
  open,
  onOpenChange,
  membro,
  travarPapel,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  membro: StaffMembro | null
  // true quando quem está editando é o próprio usuário logado - o
  // papel fica travado (autoproteção, item 3 da sequência, 24/08/2026)
  travarPapel: boolean
  onSubmit: (values: StaffFormValues) => void
  loading: boolean
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: VALORES_PADRAO,
  })

  useEffect(() => {
    if (!open) return
    reset(
      membro
        ? {
            nome: membro.nome,
            email: membro.email,
            whatsapp: membro.whatsapp ? formatarWhatsapp(membro.whatsapp) : '',
            role: membro.role,
            pode_aceitar_pedido: membro.pode_aceitar_pedido,
          }
        : VALORES_PADRAO
    )
  }, [open, membro, reset])

  const papelAtual = watch('role')

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={membro ? 'Editar membro da equipe' : 'Adicionar membro da equipe'}
      description={
        membro
          ? 'Ajuste o papel e as permissões deste membro.'
          : 'Um e-mail será enviado para o novo membro definir a própria senha.'
      }
      // Tira a máscara antes de subir pro pai/Route Handler — só dígitos,
      // mesma convenção de customers.whatsapp.
      onSubmit={handleSubmit((v) => onSubmit({ ...v, whatsapp: v.whatsapp.replace(/\D/g, '') }))}
      submitLabel={membro ? 'Salvar alterações' : 'Adicionar membro'}
      loading={loading}
    >
      <div className="space-y-1.5">
        <Label htmlFor="staff-nome">Nome *</Label>
        <Input id="staff-nome" placeholder="Nome completo" aria-invalid={!!errors.nome} {...register('nome')} />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staff-email">E-mail *</Label>
        <Input
          id="staff-email"
          type="email"
          placeholder="pessoa@email.com"
          disabled={!!membro}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {membro && <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado aqui.</p>}
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staff-whatsapp">WhatsApp</Label>
        <Controller
          control={control}
          name="whatsapp"
          render={({ field }) => (
            <Input
              id="staff-whatsapp"
              inputMode="tel"
              placeholder="(71) 99999-9999"
              aria-invalid={!!errors.whatsapp}
              value={field.value}
              onChange={(e) => field.onChange(formatarWhatsapp(e.target.value))}
              onBlur={field.onBlur}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Necessário para receber o aviso de novo pedido por WhatsApp.
        </p>
        {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staff-role">Papel *</Label>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={travarPapel}>
              <SelectTrigger id="staff-role" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="operador">Operador</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {travarPapel && (
          <p className="text-xs text-muted-foreground">Você não pode alterar o próprio papel.</p>
        )}
      </div>

      {papelAtual === 'operador' && (
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="staff-pode-aceitar">Pode aceitar pedidos</Label>
            <p className="text-xs text-muted-foreground">Permite validar/editar/cancelar/concluir pedidos.</p>
          </div>
          <Controller
            control={control}
            name="pode_aceitar_pedido"
            render={({ field }) => (
              <Switch id="staff-pode-aceitar" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      )}
    </FormDialog>
  )
}
