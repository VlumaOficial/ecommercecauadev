'use client'

import { useFormContext } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ConfiguracaoVitrineCampos } from '@/lib/loja/types'

export function VitrineWhatsAppSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ConfiguracaoVitrineCampos>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp-numero">Número</Label>
          <Input
            id="whatsapp-numero"
            placeholder="Ex.: 5511999999999 (DDI+DDD+número, só dígitos)"
            aria-invalid={!!errors.whatsapp_numero}
            {...register('whatsapp_numero')}
          />
          <p className="text-xs text-muted-foreground">
            Deixe em branco para não mostrar o botão de WhatsApp na vitrine.
          </p>
          {errors.whatsapp_numero && <p className="text-xs text-destructive">{errors.whatsapp_numero.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatsapp-mensagem">Mensagem pré-preenchida *</Label>
          <Textarea
            id="whatsapp-mensagem"
            rows={2}
            aria-invalid={!!errors.whatsapp_mensagem}
            {...register('whatsapp_mensagem')}
          />
          {errors.whatsapp_mensagem && <p className="text-xs text-destructive">{errors.whatsapp_mensagem.message}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
