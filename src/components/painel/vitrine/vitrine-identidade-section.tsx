'use client'

import { Controller, useFormContext } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ColorInput } from '@/components/ui/color-input'
import { ImagemUploadField } from './imagem-upload-field'
import type { ConfiguracaoVitrineCampos } from '@/lib/loja/types'

export function VitrineIdentidadeSection() {
  const {
    control,
    formState: { errors },
  } = useFormContext<ConfiguracaoVitrineCampos>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cor-principal">Cor principal *</Label>
          <Controller
            control={control}
            name="cor_principal"
            render={({ field }) => (
              <ColorInput
                id="cor-principal"
                value={field.value}
                onChange={field.onChange}
                aria-invalid={!!errors.cor_principal}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">
            Usada em botões, links e destaques em toda a vitrine (nome/logo ficam como estão).
          </p>
          {errors.cor_principal && <p className="text-xs text-destructive">{errors.cor_principal.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Logo</Label>
          <Controller
            control={control}
            name="logo_path"
            render={({ field }) => (
              <ImagemUploadField path={field.value} tipo="logo" onChange={field.onChange} aspectoQuadrado />
            )}
          />
          <p className="text-xs text-muted-foreground">Sem imagem enviada, usa a logo padrão do Criatório Capuã.</p>
        </div>
      </CardContent>
    </Card>
  )
}
