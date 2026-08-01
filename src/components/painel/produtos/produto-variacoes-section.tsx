'use client'

import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProdutoFormValues } from '@/hooks/use-produtos'

const VARIACAO_PADRAO = {
  nome: '',
  sku: '',
  preco: 0,
  preco_promocional: '' as const,
  modo_estoque: 'quantitativo' as const,
  saldo_estoque: 0,
  quantidade_minima: 1,
}

export function ProdutoVariacoesSection() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProdutoFormValues>()

  const { fields, append, remove } = useFieldArray({ control, name: 'variacoes' })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Variações</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ ...VARIACAO_PADRAO })}
        >
          <PlusIcon />
          Adicionar variação
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {errors.variacoes?.root && (
          <p className="text-xs text-destructive">{errors.variacoes.root.message}</p>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor={`variacao-${index}-nome`}>Rótulo</Label>
                <Input
                  id={`variacao-${index}-nome`}
                  placeholder="Padrão"
                  {...register(`variacoes.${index}.nome`)}
                />
              </div>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mt-6"
                  onClick={() => remove(index)}
                  aria-label="Remover variação"
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`variacao-${index}-preco`}>Preço *</Label>
                <Input
                  id={`variacao-${index}-preco`}
                  type="number"
                  step="0.01"
                  aria-invalid={!!errors.variacoes?.[index]?.preco}
                  {...register(`variacoes.${index}.preco`)}
                />
                {errors.variacoes?.[index]?.preco && (
                  <p className="text-xs text-destructive">{errors.variacoes[index]?.preco?.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`variacao-${index}-promo`}>Preço promocional</Label>
                <Input
                  id={`variacao-${index}-promo`}
                  type="number"
                  step="0.01"
                  aria-invalid={!!errors.variacoes?.[index]?.preco_promocional}
                  {...register(`variacoes.${index}.preco_promocional`)}
                />
                {errors.variacoes?.[index]?.preco_promocional && (
                  <p className="text-xs text-destructive">
                    {errors.variacoes[index]?.preco_promocional?.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`variacao-${index}-estoque`}>Estoque</Label>
                <Input
                  id={`variacao-${index}-estoque`}
                  type="number"
                  {...register(`variacoes.${index}.saldo_estoque`)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`variacao-${index}-qtd-min`}>Quantidade mínima</Label>
                <Input
                  id={`variacao-${index}-qtd-min`}
                  type="number"
                  {...register(`variacoes.${index}.quantidade_minima`)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`variacao-${index}-modo`}>Modo de estoque</Label>
                <Controller
                  control={control}
                  name={`variacoes.${index}.modo_estoque`}
                  render={({ field: selectField }) => (
                    <Select value={selectField.value} onValueChange={selectField.onChange}>
                      <SelectTrigger id={`variacao-${index}-modo`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quantitativo">Controlar quantidade</SelectItem>
                        <SelectItem value="disponibilidade">Só disponível/indisponível</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`variacao-${index}-sku`}>SKU</Label>
                <Input
                  id={`variacao-${index}-sku`}
                  placeholder="Automático"
                  {...register(`variacoes.${index}.sku`)}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
