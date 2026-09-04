import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { criarProdutoComoStaff } from '@/lib/painel/produtos'

// Frente A (Gestão de Catálogo em Escala), incremento 1 - aprovado pelo
// PO em 04/09/2026. Recebe um LOTE de GRUPOS já parseados/agrupados no
// browser (parseSpreadsheetFile, src/lib/importacao/) - uma linha por
// variação, agrupadas por um identificador explícito (ou grupo de 1
// linha quando não informado). O parsing e o agrupamento em si nunca
// acontecem aqui, só a validação/criação.
//
// Atomicidade por PRODUTO, parcial entre produtos (decisão do PO): cada
// grupo é processado com try/catch próprio - se qualquer variação do
// grupo for inválida, o PRODUTO INTEIRO não é criado (nenhuma variação
// dele), mas os demais grupos do lote seguem normalmente. Isso é dado
// de graça pela RPC criar_produto_com_variacoes (uma chamada = uma
// transação: produto + todas as variações juntas).
const variacaoLinhaSchema = z.object({
  linha: z.number().int().positive(),
  variacao_nome: z.string(),
  sku: z.string(),
  preco: z.string(),
  preco_promocional: z.string(),
  estoque: z.string(),
  quantidade_minima_estoque: z.string(),
  quantidade_minima_venda: z.string(),
})

const grupoSchema = z.object({
  linhas: z.array(z.number().int().positive()).min(1),
  nome: z.string(),
  descricao: z.string(),
  categoria: z.string(),
  unidade: z.string(),
  codigo: z.string(),
  destaque: z.string(),
  codigo_visivel: z.string(),
  variacoes: z.array(variacaoLinhaSchema).min(1),
})

const loteSchema = z.object({
  grupos: z.array(grupoSchema).min(1).max(30),
})

export type ResultadoGrupo =
  | { linhas: number[]; nome: string; status: 'sucesso'; produtoId: string; variacoesCriadas: number }
  | { linhas: number[]; nome: string; status: 'erro'; motivo: string }

// Tolerante a "sim"/"não"/"true"/"false"/"1"/"0" - mesmo espírito de
// aceitar o que um lojista digitaria numa planilha, sem exigir um
// formato rígido.
function paraBooleano(v: string): boolean {
  const normalizado = v.trim().toLowerCase()
  return ['sim', 's', 'true', 'verdadeiro', '1'].includes(normalizado)
}

// Aceita "12.50" e o formato BR "12,50" (vírgula decimal) - planilhas
// digitadas por lojista tendem a vir no formato BR.
function paraNumero(v: string): number | null {
  const limpo = v.trim()
  if (!limpo) return null
  const normalizado = /,\d{1,2}$/.test(limpo) && !limpo.includes('.') ? limpo.replace(',', '.') : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

function paraInteiro(v: string): number | null {
  const n = paraNumero(v)
  return n === null ? null : Math.trunc(n)
}

function normalizarTexto(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = loteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Lote inválido.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Categorias e unidades do tenant, buscadas UMA vez pro lote inteiro
  // (nunca 1 query por grupo) - casamento por nome, case-insensitive/
  // trim. Categorias novas já deveriam ter sido criadas ANTES desta
  // chamada (passo de confirmação no browser, POST /api/painel/
  // categorias por nome novo) - o lookup aqui é defensivo, não o
  // caminho de criação.
  const [{ data: categorias }, { data: unidades }] = await Promise.all([
    supabase.from('categories').select('id, nome').eq('tenant_id', perfil.tenant_id).eq('ativo', true),
    supabase.from('unidades_venda').select('id, nome').eq('tenant_id', perfil.tenant_id).eq('ativo', true),
  ])
  const categoriasPorNome = new Map((categorias ?? []).map((c) => [normalizarTexto(c.nome), c.id]))
  const unidadesPorNome = new Map((unidades ?? []).map((u) => [normalizarTexto(u.nome), u.id]))
  const unidadePadraoId = unidadesPorNome.get('unidade') ?? null

  // Pré-checagem de SKU já existente no banco (UMA query pro lote
  // inteiro) - permite atribuir o erro à linha exata do SKU em vez de
  // depender só da mensagem genérica da RPC. Defesa em profundidade:
  // a RPC também rejeita SKU duplicado (unique(tenant_id, sku)),
  // cobrindo corrida entre importações concorrentes.
  const todosSkus = parsed.data.grupos.flatMap((g) => g.variacoes.map((v) => v.sku.trim()).filter(Boolean))
  const { data: skusExistentes } =
    todosSkus.length > 0
      ? await supabase.from('product_variants').select('sku').eq('tenant_id', perfil.tenant_id).in('sku', todosSkus)
      : { data: [] as { sku: string }[] }
  const skusJaCadastrados = new Set((skusExistentes ?? []).map((s) => s.sku).filter((sku): sku is string => !!sku))

  const resultados: ResultadoGrupo[] = []
  for (const grupo of parsed.data.grupos) {
    try {
      resultados.push(await processarGrupo(grupo, { categoriasPorNome, unidadesPorNome, unidadePadraoId, skusJaCadastrados }, supabase))
    } catch {
      resultados.push({ linhas: grupo.linhas, nome: grupo.nome || '(sem nome)', status: 'erro', motivo: 'Não foi possível processar este produto. Tente novamente.' })
    }
  }

  return NextResponse.json({ resultados })
}

type ContextoLote = {
  categoriasPorNome: Map<string, string>
  unidadesPorNome: Map<string, string>
  unidadePadraoId: string | null
  skusJaCadastrados: Set<string>
}

async function processarGrupo(
  grupo: z.infer<typeof grupoSchema>,
  ctx: ContextoLote,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ResultadoGrupo> {
  const erro = (motivo: string): ResultadoGrupo => ({
    linhas: grupo.linhas,
    nome: grupo.nome.trim() || '(sem nome)',
    status: 'erro',
    motivo,
  })

  const nome = grupo.nome.trim()
  const categoriaNome = grupo.categoria.trim()
  const unidadeNome = grupo.unidade.trim()
  const codigo = grupo.codigo.trim()

  // Revalidação completa server-side, nunca confia no client. 1ª linha
  // do grupo sem nome/categoria = "produto sem definição".
  if (!nome) return erro(`Linha ${grupo.linhas[0]}: produto sem nome (a primeira linha do grupo precisa preencher o nome).`)
  if (!categoriaNome) return erro(`Linha ${grupo.linhas[0]}: categoria em branco.`)

  const categoryId = ctx.categoriasPorNome.get(normalizarTexto(categoriaNome))
  if (!categoryId) {
    return erro(`Categoria "${categoriaNome}" não encontrada (não foi criada automaticamente antes da importação).`)
  }

  let unidadeVendaId: string | null
  if (!unidadeNome) {
    unidadeVendaId = ctx.unidadePadraoId
    if (!unidadeVendaId) return erro('Unidade de venda padrão ("Unidade") não encontrada para esta loja.')
  } else {
    const encontrada = ctx.unidadesPorNome.get(normalizarTexto(unidadeNome))
    if (!encontrada) return erro(`Unidade de venda "${unidadeNome}" não encontrada — cadastre em /painel/unidades-venda primeiro.`)
    unidadeVendaId = encontrada
  }

  // Valida cada variação do grupo - a primeira que falhar reprova o
  // PRODUTO INTEIRO (atomicidade por produto, decisão do PO), com a
  // linha exata no motivo.
  const variacoesValidadas: {
    nome?: string
    sku?: string
    preco: number
    preco_promocional?: number | null
    estoque_inicial?: number | null
    quantidade_minima_estoque?: number
    quantidade_minima_venda?: number
  }[] = []

  for (const v of grupo.variacoes) {
    const skuTrim = v.sku.trim()
    if (skuTrim && ctx.skusJaCadastrados.has(skuTrim)) {
      return erro(`Linha ${v.linha}: SKU "${skuTrim}" já cadastrado em outro produto.`)
    }

    const preco = paraNumero(v.preco)
    if (preco === null || preco < 0) return erro(`Linha ${v.linha}: preço inválido.`)

    let precoPromocional: number | null = null
    if (v.preco_promocional.trim()) {
      precoPromocional = paraNumero(v.preco_promocional)
      if (precoPromocional === null || precoPromocional < 0) return erro(`Linha ${v.linha}: preço promocional inválido.`)
      if (precoPromocional >= preco) return erro(`Linha ${v.linha}: preço promocional maior ou igual ao preço.`)
    }

    let estoqueInicial: number | null = null
    if (v.estoque.trim()) {
      estoqueInicial = paraInteiro(v.estoque)
      if (estoqueInicial === null || estoqueInicial < 0) return erro(`Linha ${v.linha}: estoque inválido.`)
    }

    let quantidadeMinimaEstoque = 1
    if (v.quantidade_minima_estoque.trim()) {
      const n = paraInteiro(v.quantidade_minima_estoque)
      if (n === null || n < 1) return erro(`Linha ${v.linha}: quantidade mínima de estoque inválida.`)
      quantidadeMinimaEstoque = n
    }

    let quantidadeMinimaVenda = 1
    if (v.quantidade_minima_venda.trim()) {
      const n = paraInteiro(v.quantidade_minima_venda)
      if (n === null || n < 1) return erro(`Linha ${v.linha}: quantidade mínima de venda inválida.`)
      quantidadeMinimaVenda = n
    }

    variacoesValidadas.push({
      nome: v.variacao_nome.trim() || undefined,
      sku: skuTrim || undefined,
      preco,
      preco_promocional: precoPromocional,
      estoque_inicial: estoqueInicial,
      quantidade_minima_estoque: quantidadeMinimaEstoque,
      quantidade_minima_venda: quantidadeMinimaVenda,
    })
  }

  const resultado = await criarProdutoComoStaff(supabase, {
    produto: {
      category_id: categoryId,
      nome,
      descricao: grupo.descricao.trim() || null,
      unidade_venda_id: unidadeVendaId,
      destaque: paraBooleano(grupo.destaque),
      ativo: true,
      codigo_visivel: paraBooleano(grupo.codigo_visivel),
    },
    codigo_modo: codigo ? 'manual' : 'automatico',
    codigo_manual: codigo || undefined,
    variacoes: variacoesValidadas,
  })

  if (!resultado.ok) {
    return erro(`Não criado — ${resultado.error}`)
  }

  return {
    linhas: grupo.linhas,
    nome,
    status: 'sucesso',
    produtoId: resultado.produto.id,
    variacoesCriadas: variacoesValidadas.length,
  }
}
