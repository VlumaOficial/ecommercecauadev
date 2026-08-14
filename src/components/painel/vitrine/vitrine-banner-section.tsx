'use client'

import { Controller, useFormContext } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ColorInput } from '@/components/ui/color-input'
import { ImagemUploadField } from './imagem-upload-field'
import type { ConfiguracaoVitrineCampos } from '@/lib/loja/types'

export function VitrineBannerSection() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<ConfiguracaoVitrineCampos>()

  const tipoFundo = watch('banner_tipo_fundo')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Banner da home</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="banner-titulo">Título *</Label>
          <Input id="banner-titulo" aria-invalid={!!errors.banner_titulo} {...register('banner_titulo')} />
          {errors.banner_titulo && <p className="text-xs text-destructive">{errors.banner_titulo.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="banner-subtitulo">Subtítulo *</Label>
          <Textarea
            id="banner-subtitulo"
            rows={2}
            aria-invalid={!!errors.banner_subtitulo}
            {...register('banner_subtitulo')}
          />
          {errors.banner_subtitulo && <p className="text-xs text-destructive">{errors.banner_subtitulo.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="banner-botao-texto">Texto do botão *</Label>
            <Input
              id="banner-botao-texto"
              aria-invalid={!!errors.banner_botao_texto}
              {...register('banner_botao_texto')}
            />
            {errors.banner_botao_texto && (
              <p className="text-xs text-destructive">{errors.banner_botao_texto.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="banner-botao-href">Destino do botão *</Label>
            <Input
              id="banner-botao-href"
              placeholder="/produtos"
              aria-invalid={!!errors.banner_botao_href}
              {...register('banner_botao_href')}
            />
            {errors.banner_botao_href && <p className="text-xs text-destructive">{errors.banner_botao_href.message}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="banner-usa-imagem">Usar imagem de fundo</Label>
            <p className="text-xs text-muted-foreground">Desligado usa uma cor sólida (com gradiente).</p>
          </div>
          <Controller
            control={control}
            name="banner_tipo_fundo"
            render={({ field }) => (
              <Switch
                id="banner-usa-imagem"
                checked={field.value === 'imagem'}
                onCheckedChange={(checked) => field.onChange(checked ? 'imagem' : 'cor')}
              />
            )}
          />
        </div>

        {tipoFundo === 'imagem' ? (
          <div className="space-y-1.5">
            <Label>Imagem de fundo</Label>
            <Controller
              control={control}
              name="banner_imagem_path"
              render={({ field }) => (
                <ImagemUploadField path={field.value} tipo="banner" onChange={field.onChange} />
              )}
            />
            <p className="text-xs text-muted-foreground">
              Um overlay escuro é aplicado automaticamente sobre a imagem para manter o texto legível.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="banner-cor-fundo">Cor de fundo *</Label>
            <Controller
              control={control}
              name="banner_cor_fundo"
              render={({ field }) => (
                <ColorInput
                  id="banner-cor-fundo"
                  value={field.value}
                  onChange={field.onChange}
                  aria-invalid={!!errors.banner_cor_fundo}
                />
              )}
            />
            {errors.banner_cor_fundo && <p className="text-xs text-destructive">{errors.banner_cor_fundo.message}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
