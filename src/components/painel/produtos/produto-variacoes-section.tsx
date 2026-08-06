'use client'

import Link from 'next/link'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { ChevronDownIcon, ImagesIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProdutoImagensSection } from './produto-imagens-section'
import type { ImagemProduto, ProdutoFormValues } from '@/hooks/use-produtos'

const LIMITE_IMAGENS_VARIACAO = 5

const VARIACAO_PADRAO = {
  nome: '',
  sku: '',
  preco: 0,
  preco_promocional: '' as const,
  modo_estoque: 'quantitativo' as const,
  estoque_inicial: '' as const,
  quantidade_minima: 1,
}

export function ProdutoVariacoesSection({
  produtoId,
  imagens,
}: {
  produtoId?: string
  imagens?: ImagemProduto[]
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProdutoFormValues>()

  const { fields, append, remove } = useFieldArray({ control, name: 'variacoes' })
  // Le o valor ATUAL do form (nao o field.id do useFieldArray, que e
  // um id interno gerado pelo RHF pra key de renderizacao - diferente
  // do "id" de dominio da variacao, que so existe quando ela ja
  // existia no banco antes de abrir o formulario).
  const variacoesValues = useWatch({ control, name: 'variacoes' })

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
        {fields.map((field, index) => {
        // Domain id (nao o field.id do RHF): presente = variacao ja
        // existia no banco quando o form abriu (edicao) - so nesse
        // caso o estoque vira read-only, apontando pro modulo de
        // Estoque. Ausente = variacao nova (produto novo, ou
        // adicionada durante uma edicao) - estoque inicial editavel.
        const isExistente = !!variacoesValues?.[index]?.id
        // Modo "disponibilidade" nao controla saldo por quantidade -
        // registrar_estoque_inicial_variacao (migration 022) ja ignora
        // "estoque_inicial" silenciosamente nesse modo, mas o campo
        // continuava editavel sem nenhum aviso: lojista digitava um
        // numero, ele desaparecia sem explicacao nenhuma no salvar.
        // Bug real reportado pelo usuario em 06/08/2026.
        const modoDisponibilidade = variacoesValues?.[index]?.modo_estoque === 'disponibilidade'
        return (
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
                <Label htmlFor={`variacao-${index}-estoque`}>Estoque inicial</Label>
                {isExistente ? (
                  <>
                    <Input
                      id={`variacao-${index}-estoque`}
                      value={variacoesValues?.[index]?.saldo_estoque ?? 0}
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground">
                      Estoque gerenciado em{' '}
                      <Link href="/painel/estoque" className="underline hover:text-foreground">
                        Estoque
                      </Link>
                      .
                    </p>
                  </>
                ) : modoDisponibilidade ? (
                  <>
                    <Input id={`variacao-${index}-estoque`} value="" disabled readOnly placeholder="Não se aplica" />
                    <p className="text-xs text-muted-foreground">
                      Não se aplica no modo "Só disponível/indisponível" — esse modo não controla quantidade.
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      id={`variacao-${index}-estoque`}
                      type="number"
                      placeholder="0"
                      aria-invalid={!!errors.variacoes?.[index]?.estoque_inicial}
                      {...register(`variacoes.${index}.estoque_inicial`)}
                    />
                    {errors.variacoes?.[index]?.estoque_inicial && (
                      <p className="text-xs text-destructive">
                        {errors.variacoes[index]?.estoque_inicial?.message}
                      </p>
                    )}
                  </>
                )}
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

            {isExistente && produtoId && (
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ImagesIcon className="size-4" />
                  Fotos específicas desta variação — opcional
                  <ChevronDownIcon className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-3">
                    <ProdutoImagensSection
                      produtoId={produtoId}
                      variantId={variacoesValues?.[index]?.id}
                      imagens={(imagens ?? []).filter(
                        (img) => img.variant_id === variacoesValues?.[index]?.id
                      )}
                      maxImagens={LIMITE_IMAGENS_VARIACAO}
                      titulo="Fotos desta variação"
                      descricao="Aparecem só quando o cliente escolhe esta variação. Opcional — sem fotos aqui, valem as imagens gerais do produto."
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )
        })}
      </CardContent>
    </Card>
  )
}
