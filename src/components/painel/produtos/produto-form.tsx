'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useCreateProduto,
  useUpdateProduto,
  type ProdutoFormValues,
  type ProdutoDetalhe,
} from '@/hooks/use-produtos'
import { ProdutoDadosBasicos } from './produto-dados-basicos'
import { ProdutoCodigoSection } from './produto-codigo-section'
import { ProdutoVariacoesSection } from './produto-variacoes-section'

const numeroOuVazio = z.union([z.literal(''), z.coerce.number()])

const variacaoSchema = z
  .object({
    id: z.string().uuid().optional(),
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

// Em edicao, "codigo" nao faz parte do formulario (imutavel - exibido
// separado, read-only). Modo automatico/manual so existe na criacao.
function buildProdutoSchema(modo: 'novo' | 'editar') {
  const base = z.object({
    category_id: z.string().uuid('Selecione uma categoria.'),
    nome: z.string().trim().min(1, 'Informe o nome do produto.'),
    descricao: z.string().trim(),
    unidade_venda_id: z.string().uuid('Selecione a unidade de venda.'),
    destaque: z.boolean(),
    ativo: z.boolean(),
    codigo_modo: z.enum(['automatico', 'manual']),
    codigo_manual: z.string().trim(),
    codigo_visivel: z.boolean(),
    variacoes: z.array(variacaoSchema).min(1, 'Adicione pelo menos uma variação para o produto.'),
  })

  if (modo === 'novo') {
    return base.refine((v) => v.codigo_modo === 'automatico' || v.codigo_manual.trim().length > 0, {
      message: 'Informe um código ou escolha o modo automático.',
      path: ['codigo_manual'],
    })
  }
  return base
}

const VALORES_PADRAO_NOVO: ProdutoFormValues = {
  category_id: '',
  nome: '',
  descricao: '',
  // Vazio de proposito: nao da pra saber o id da unidade "Unidade" em
  // tempo de compilacao (e por tenant, gerado no seed da migration
  // 019). ProdutoDadosBasicos auto-seleciona "Unidade" assim que a
  // lista carrega, se nada tiver sido escolhido ainda - ver comentario
  // la.
  unidade_venda_id: '',
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

function valoresIniciaisEdicao(produto: ProdutoDetalhe): ProdutoFormValues {
  return {
    category_id: produto.category_id,
    nome: produto.nome,
    descricao: produto.descricao ?? '',
    unidade_venda_id: produto.unidade_venda_id,
    destaque: produto.destaque,
    ativo: produto.ativo,
    codigo_modo: 'manual', // nao usado em edicao, so pra satisfazer o tipo
    codigo_manual: produto.codigo ?? '',
    codigo_visivel: produto.codigo_visivel,
    variacoes: produto.variacoes.map((v) => ({
      id: v.id,
      nome: v.nome,
      sku: v.sku ?? '',
      preco: v.preco,
      preco_promocional: v.preco_promocional ?? '',
      modo_estoque: v.modo_estoque,
      saldo_estoque: v.saldo_estoque,
      quantidade_minima: v.quantidade_minima,
    })),
  }
}

export function ProdutoForm({ produto }: { produto?: ProdutoDetalhe }) {
  const router = useRouter()
  const criar = useCreateProduto()
  const atualizar = useUpdateProduto()

  const modo = produto ? 'editar' : 'novo'
  const produtoSchema = buildProdutoSchema(modo)

  const methods = useForm<
    z.input<typeof produtoSchema>,
    unknown,
    z.output<typeof produtoSchema>
  >({
    resolver: zodResolver(produtoSchema),
    defaultValues: produto ? valoresIniciaisEdicao(produto) : VALORES_PADRAO_NOVO,
  })

  const salvando = criar.isPending || atualizar.isPending

  function onSubmit(values: ProdutoFormValues) {
    if (produto) {
      atualizar.mutate(
        { id: produto.id, values },
        { onSuccess: () => router.push('/painel/produtos') }
      )
    } else {
      criar.mutate(values, { onSuccess: () => router.push('/painel/produtos') })
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" render={<Link href="/painel/produtos" />} nativeButton={false} aria-label="Voltar">
              <ArrowLeftIcon />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">
                {produto ? `Editar ${produto.nome}` : 'Novo produto'}
              </h1>
              <p className="text-muted-foreground mt-1">Preencha os dados, o código e as variações do produto.</p>
            </div>
          </div>
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : produto ? 'Salvar alterações' : 'Criar produto'}
          </Button>
        </div>

        <ProdutoDadosBasicos />
        <ProdutoCodigoSection codigoAtual={produto?.codigo ?? null} />
        <ProdutoVariacoesSection />
      </form>
    </FormProvider>
  )
}
