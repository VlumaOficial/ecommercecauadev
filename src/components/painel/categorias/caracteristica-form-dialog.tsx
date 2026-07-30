'use client'

import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PlusIcon, XIcon } from 'lucide-react'

import { FormDialog } from '@/components/painel/crud/form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Caracteristica, CaracteristicaFormValues } from '@/hooks/use-caracteristicas'

const TIPOS = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Numero' },
  { value: 'selecao', label: 'Selecao' },
  { value: 'booleano', label: 'Sim/Nao' },
] as const

const caracteristicaSchema = z
  .object({
    rotulo: z.string().trim().min(1, 'Informe o nome da caracteristica.'),
    tipo: z.enum(['texto', 'numero', 'selecao', 'booleano']),
    opcoes: z.array(z.string().trim().min(1, 'Opcao nao pode ficar vazia.')),
    obrigatorio: z.boolean(),
    usar_em_filtro: z.boolean(),
    ativo: z.boolean(),
  })
  .refine((v) => v.tipo !== 'selecao' || v.opcoes.length > 0, {
    message: 'Informe pelo menos uma opcao.',
    path: ['opcoes'],
  })

const VALORES_PADRAO: CaracteristicaFormValues = {
  rotulo: '',
  tipo: 'texto',
  opcoes: [],
  obrigatorio: false,
  usar_em_filtro: false,
  ativo: true,
}

// Igual ao padrao aprendido em Categoria: defaultValues computados
// direto do registro (nao via reset() em useEffect) + key={id} no
// ponto de renderizacao. Aqui nem existe o risco de corrida do slug
// (chave e gerada silenciosamente no servidor), mas mantem o mesmo
// padrao de inicializacao por seguranca/consistencia.
function valoresIniciais(caracteristica: Caracteristica | null): CaracteristicaFormValues {
  if (!caracteristica) return VALORES_PADRAO
  return {
    rotulo: caracteristica.rotulo,
    tipo: caracteristica.tipo === 'data' ? 'texto' : caracteristica.tipo,
    opcoes: caracteristica.opcoes ?? [],
    obrigatorio: caracteristica.obrigatorio,
    usar_em_filtro: caracteristica.usar_em_filtro,
    ativo: caracteristica.ativo,
  }
}

export function CaracteristicaFormDialog({
  open,
  onOpenChange,
  caracteristica,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  caracteristica: Caracteristica | null
  onSubmit: (values: CaracteristicaFormValues) => void
  loading: boolean
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CaracteristicaFormValues>({
    resolver: zodResolver(caracteristicaSchema),
    defaultValues: valoresIniciais(caracteristica),
  })

  const tipo = watch('tipo')

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={caracteristica ? 'Editar caracteristica' : 'Nova caracteristica'}
      description="Ficha tecnica e filtros para os produtos desta categoria."
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={caracteristica ? 'Salvar alteracoes' : 'Criar caracteristica'}
      loading={loading}
    >
      <div className="space-y-1.5">
        <Label htmlFor="caracteristica-rotulo">Nome *</Label>
        <Input
          id="caracteristica-rotulo"
          placeholder="Ex.: Cor"
          aria-invalid={!!errors.rotulo}
          {...register('rotulo')}
        />
        {errors.rotulo && <p className="text-xs text-destructive">{errors.rotulo.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="caracteristica-tipo">Tipo *</Label>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="caracteristica-tipo" className="w-full">
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

      {tipo === 'selecao' && (
        <div className="space-y-1.5">
          <Label>Opcoes *</Label>
          <Controller
            control={control}
            name="opcoes"
            render={({ field }) => (
              <div className="space-y-1.5">
                {field.value.map((opcao, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <Input
                      value={opcao}
                      onChange={(e) => {
                        const proxima = [...field.value]
                        proxima[index] = e.target.value
                        field.onChange(proxima)
                      }}
                      placeholder={`Opcao ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => field.onChange(field.value.filter((_, i) => i !== index))}
                      aria-label="Remover opcao"
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => field.onChange([...field.value, ''])}
                >
                  <PlusIcon />
                  Adicionar opcao
                </Button>
              </div>
            )}
          />
          {errors.opcoes && <p className="text-xs text-destructive">{errors.opcoes.message}</p>}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <Label htmlFor="caracteristica-obrigatorio">Obrigatoria</Label>
        <Controller
          control={control}
          name="obrigatorio"
          render={({ field }) => (
            <Switch id="caracteristica-obrigatorio" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <Label htmlFor="caracteristica-filtro">Usar como filtro na vitrine</Label>
        <Controller
          control={control}
          name="usar_em_filtro"
          render={({ field }) => (
            <Switch id="caracteristica-filtro" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <Label htmlFor="caracteristica-ativo">Caracteristica ativa</Label>
        <Controller
          control={control}
          name="ativo"
          render={({ field }) => (
            <Switch id="caracteristica-ativo" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>
    </FormDialog>
  )
}
