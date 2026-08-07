'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useCreateProduto,
  useUpdateProduto,
  type ProdutoFormValues,
  type ProdutoDetalhe,
  type CaracteristicaPayload,
} from '@/hooks/use-produtos'
import { ProdutoDadosBasicos } from './produto-dados-basicos'
import { ProdutoCodigoSection } from './produto-codigo-section'
import { ProdutoVariacoesSection } from './produto-variacoes-section'
import { ProdutoImagensSection } from './produto-imagens-section'
import { ProdutoCaracteristicasSection } from './produto-caracteristicas-section'
import { useCaracteristicas } from '@/hooks/use-caracteristicas'

const numeroOuVazio = z.union([z.literal(''), z.coerce.number()])

const variacaoSchema = z
  .object({
    id: z.string().uuid().optional(),
    nome: z.string().trim(),
    sku: z.string().trim(),
    // Vazio enquanto digita (CurrencyInput comeca sem valor, nao com
    // "0" pre-preenchido) - obrigatorio na hora de salvar, validado no
    // refine abaixo (nao dá pra coagir '' pra numero>=0 aqui e ainda
    // rejeitar vazio ao mesmo tempo).
    preco: numeroOuVazio,
    preco_promocional: numeroOuVazio,
    modo_estoque: z.enum(['quantitativo', 'disponibilidade']),
    // Opcional (variacao NOVA) - variacao ja existente nem mostra o
    // campo editavel, so exibe saldo_estoque de referencia. Modulo de
    // Estoque, migration 022.
    estoque_inicial: numeroOuVazio,
    saldo_estoque: z.number().optional(),
    quantidade_minima_estoque: z.coerce.number().min(1, 'O mínimo de estoque deve ser pelo menos 1.'),
    quantidade_minima_venda: z.coerce.number().min(1, 'O mínimo de venda deve ser pelo menos 1.'),
  })
  .refine((v) => v.preco !== '', {
    message: 'Informe o preço.',
    path: ['preco'],
  })
  .refine((v) => v.preco === '' || v.preco >= 0, {
    message: 'O preço não pode ser negativo.',
    path: ['preco'],
  })
  .refine((v) => v.preco_promocional === '' || v.preco === '' || v.preco_promocional < v.preco, {
    message: 'O preço promocional deve ser menor que o preço normal.',
    path: ['preco_promocional'],
  })
  .refine((v) => v.estoque_inicial === '' || v.estoque_inicial >= 0, {
    message: 'O estoque inicial não pode ser negativo.',
    path: ['estoque_inicial'],
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
    codigo_modo: z.enum(['automatico', 'categoria', 'manual']),
    codigo_manual: z.string().trim(),
    codigo_visivel: z.boolean(),
    variacoes: z.array(variacaoSchema).min(1, 'Adicione pelo menos uma variação para o produto.'),
    // Etapa 2 (Caracteristicas): attribute_id -> valor. Obrigatoriedade
    // NAO e validada aqui de proposito - depende da categoria
    // selecionada (dado externo, buscado via query), nao de uma regra
    // estatica do schema. Validado no onSubmit do ProdutoForm via
    // methods.setError, contra a lista de caracteristicas ATIVAS da
    // categoria no momento do submit (mesma fonte de verdade do
    // servidor).
    caracteristicas: z.record(z.string(), z.string()),
  })

  if (modo === 'novo') {
    return base.refine((v) => v.codigo_modo !== 'manual' || v.codigo_manual.trim().length > 0, {
      message: 'Informe um código ou escolha um modo automático.',
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
  caracteristicas: {},
  variacoes: [
    {
      nome: 'Padrão',
      sku: '',
      // Vazio, nao 0 - mesmo motivo do VARIACAO_PADRAO em
      // produto-variacoes-section.tsx (achado ao revisar: esta copia
      // aqui, usada só pela 1a variação de um produto novo, tinha
      // ficado pra tras com "0" ainda).
      preco: '',
      preco_promocional: '',
      modo_estoque: 'quantitativo',
      estoque_inicial: '',
      quantidade_minima_estoque: 1,
      quantidade_minima_venda: 1,
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
    // attribute_id -> valor, a partir das linhas ja existentes em
    // product_attribute_values (GET /api/painel/produtos/[id] ja
    // devolve isso). Caracteristica sem valor preenchido simplesmente
    // nao tem chave aqui - o campo renderiza vazio.
    caracteristicas: Object.fromEntries(
      produto.caracteristicas.map((c) => [c.attribute_id, c.valor ?? ''])
    ),
    variacoes: produto.variacoes.map((v) => ({
      id: v.id,
      nome: v.nome,
      sku: v.sku ?? '',
      preco: v.preco,
      preco_promocional: v.preco_promocional ?? '',
      modo_estoque: v.modo_estoque,
      // Variacao ja existente: campo editavel fica vazio (nao se
      // aplica mais), so_estoque carrega o saldo atual pra exibicao
      // read-only.
      estoque_inicial: '',
      saldo_estoque: v.saldo_estoque,
      quantidade_minima_estoque: v.quantidade_minima_estoque,
      quantidade_minima_venda: v.quantidade_minima_venda,
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

  const categoryId = useWatch({ control: methods.control, name: 'category_id' }) ?? ''
  // Fonte unica: ProdutoCaracteristicasSection recebe "ativas" pronta
  // via prop (nao busca de novo) - garante que a lista usada pra
  // renderizar os campos e a lista usada pra validar/montar o payload
  // no onSubmit sejam exatamente a mesma instancia, no mesmo render.
  const { data: caracteristicasDaCategoria = [], isLoading: carregandoCaracteristicas } =
    useCaracteristicas(categoryId || null)
  const caracteristicasAtivas = caracteristicasDaCategoria.filter((c) => c.ativo)

  function onSubmit(values: ProdutoFormValues) {
    // Obrigatoriedade das caracteristicas: nao da pra validar no
    // schema estatico (depende da categoria, dado buscado). Fonte da
    // verdade e a mesma lista de caracteristicas ATIVAS usada pra
    // montar o payload logo abaixo - se mudou de categoria, valida
    // contra a nova.
    methods.clearErrors('caracteristicas')
    let temCampoObrigatorioVazio = false
    for (const attr of caracteristicasAtivas) {
      if (attr.obrigatorio && !(values.caracteristicas[attr.id] ?? '').trim()) {
        methods.setError(`caracteristicas.${attr.id}`, { message: 'Obrigatório.' })
        temCampoObrigatorioVazio = true
      }
    }
    if (temCampoObrigatorioVazio) return

    const caracteristicasPayload: CaracteristicaPayload[] = caracteristicasAtivas.map((attr) => ({
      attribute_id: attr.id,
      valor: values.caracteristicas[attr.id] ?? '',
    }))

    if (produto) {
      atualizar.mutate(
        { id: produto.id, values, caracteristicas: caracteristicasPayload },
        { onSuccess: () => router.push('/painel/produtos') }
      )
    } else {
      criar.mutate(
        { values, caracteristicas: caracteristicasPayload },
        { onSuccess: () => router.push('/painel/produtos') }
      )
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6 pb-20">
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
          <Button type="submit" disabled={salvando || carregandoCaracteristicas}>
            {salvando
              ? 'Salvando...'
              : carregandoCaracteristicas
                ? 'Carregando características...'
                : produto
                  ? 'Salvar alterações'
                  : 'Criar produto'}
          </Button>
        </div>

        <ProdutoDadosBasicos />
        <ProdutoCodigoSection codigoAtual={produto?.codigo ?? null} />
        <ProdutoVariacoesSection produtoId={produto?.id} imagens={produto?.imagens} />
        <ProdutoCaracteristicasSection
          categoryId={categoryId}
          ativas={caracteristicasAtivas}
          carregando={carregandoCaracteristicas}
        />
        {produto ? (
          <ProdutoImagensSection
            produtoId={produto.id}
            imagens={produto.imagens.filter((img) => !img.variant_id)}
            maxImagens={10}
            titulo="Imagens do produto"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Imagens do produto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Salve o produto primeiro para poder adicionar imagens.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Barra fixa no rodape com o botao de salvar - em produtos
        com muitas variacoes, o botao do topo ficava fora de alcance
        sem rolar a pagina inteira de volta. Fixed (nao sticky) porque
        o layout do painel nao tem um container com scroll proprio - a
        pagina inteira rola no document; "lg:left-64" desvia da
        largura fixa da sidebar (painel-sidebar.tsx) em telas grandes,
        onde ela fica sempre visivel ao lado. */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-[#f6f8fb]/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl justify-end px-4 py-3 sm:px-6 lg:px-8">
            <Button type="submit" disabled={salvando || carregandoCaracteristicas}>
              {salvando
                ? 'Salvando...'
                : carregandoCaracteristicas
                  ? 'Carregando características...'
                  : produto
                    ? 'Salvar alterações'
                    : 'Criar produto'}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
