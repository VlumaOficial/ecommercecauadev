'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCreateProduto, type ProdutoFormValues } from '@/hooks/use-produtos'
import { ProdutoDadosBasicos } from './produto-dados-basicos'
import { ProdutoCodigoSection } from './produto-codigo-section'
import { ProdutoVariacoesSection } from './produto-variacoes-section'

const numeroOuVazio = z.union([z.coerce.number(), z.literal('')])

const variacaoSchema = z
  .object({
    nome: z.string().trim(),
    sku: z.string().trim(),
    preco: z.coerce.number().min(0, 'O preço não pode ser negativo.'),
    preco_promocional: numeroOuVazio,
    modo_estoque: z.enum(['quantitativo', 'disponibilidade']),
    saldo_estoque: z.coerce.number().min(0, 'O estoque não pode ser negativo.'),
    quantidade_minima: z.coerce.number().min(1, 'A quantidade mínima deve ser pelo menos 1.'),
  })
  .refine((v) => v.preco_promocional === '' || v.preco_promocional < v.preco, {
    message: 'O preço promocional deve ser menor que o preço normal.',
    path: ['preco_promocional'],
  })

const produtoSchema = z
  .object({
    category_id: z.string().uuid('Selecione uma categoria.'),
    nome: z.string().trim().min(1, 'Informe o nome do produto.'),
    descricao: z.string().trim(),
    unidade_venda: z.string().trim().min(1, 'Informe a unidade de venda.'),
    destaque: z.boolean(),
    ativo: z.boolean(),
    codigo_modo: z.enum(['automatico', 'manual']),
    codigo_manual: z.string().trim(),
    codigo_visivel: z.boolean(),
    variacoes: z.array(variacaoSchema).min(1, 'Adicione pelo menos uma variação para o produto.'),
  })
  .refine((v) => v.codigo_modo === 'automatico' || v.codigo_manual.trim().length > 0, {
    message: 'Informe um código ou escolha o modo automático.',
    path: ['codigo_manual'],
  })

const VALORES_PADRAO: ProdutoFormValues = {
  category_id: '',
  nome: '',
  descricao: '',
  unidade_venda: 'unidade',
  destaque: false,
  ativo: true,
  codigo_modo: 'automatico',
  codigo_manual: '',
  codigo_visivel: false,
  variacoes: [
    {
      nome: 'Padrão',
      sku: '',
      preco: 0,
      preco_promocional: '',
      modo_estoque: 'quantitativo',
      saldo_estoque: 0,
      quantidade_minima: 1,
    },
  ],
}

export function ProdutoForm() {
  const router = useRouter()
  const criar = useCreateProduto()

  // 3 generics pro RHF: TFieldValues (o que os inputs guardam antes de
  // validar - z.coerce aceita string/number/etc, tipo "input" do zod)
  // e TTransformedValues (o que chega em onSubmit, ja validado/coagido
  // - tipo "output" do zod, bate com ProdutoFormValues). Sem isso o
  // z.coerce.number() das variacoes gera conflito de tipo entre o
  // valor cru do input (string) e o numero esperado no submit.
  const methods = useForm<
    z.input<typeof produtoSchema>,
    unknown,
    z.output<typeof produtoSchema>
  >({
    resolver: zodResolver(produtoSchema),
    defaultValues: VALORES_PADRAO,
  })

  function onSubmit(values: ProdutoFormValues) {
    criar.mutate(values, {
      onSuccess: () => router.push('/painel/produtos'),
    })
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" render={<Link href="/painel/produtos" />} aria-label="Voltar">
              <ArrowLeftIcon />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Novo produto</h1>
              <p className="text-muted-foreground mt-1">Preencha os dados, o código e as variações do produto.</p>
            </div>
          </div>
          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? 'Salvando...' : 'Criar produto'}
          </Button>
        </div>

        <ProdutoDadosBasicos />
        <ProdutoCodigoSection />
        <ProdutoVariacoesSection />
      </form>
    </FormProvider>
  )
}
