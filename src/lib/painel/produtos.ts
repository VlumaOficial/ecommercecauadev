import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/types/database'
import { slugify } from '@/lib/category-tree'
import { derivarPrefixo } from '@/lib/produto-codigo'

type SupabaseServerClient = SupabaseClient<Database>

export type VariacaoInput = {
  nome?: string
  sku?: string
  preco: number
  preco_promocional?: number | null
  modo_estoque?: 'quantitativo' | 'disponibilidade'
  estoque_inicial?: number | null
  quantidade_minima_estoque?: number
  quantidade_minima_venda?: number
}

export type CriarProdutoParams = {
  produto: {
    category_id: string
    nome: string
    descricao?: string | null
    unidade_venda_id: string
    destaque?: boolean
    ativo?: boolean
    codigo_visivel?: boolean
  }
  // 'automatico': prefixo derivado do NOME do produto (decisão #25,
  // padrão atual da tela manual). 'categoria': prefixo da categoria
  // (decisão #18, modo "herdar"). 'manual': código trazido pelo
  // lojista (migração de outro sistema).
  codigo_modo: 'automatico' | 'categoria' | 'manual'
  codigo_manual?: string
  variacoes: VariacaoInput[]
  caracteristicas?: { attribute_id: string; valor: string }[]
}

export type CriarProdutoResultado =
  | { ok: true; produto: Tables<'products'> }
  | { ok: false; error: string }

// Extraída de POST /api/painel/produtos (CRUD manual) para ser
// reaproveitada pela importação em massa (Frente A, Inc 1) - mesmo
// padrão de criarClienteComoStaff (Fase 3, Inc 3). Orquestra: decidir/
// gerar o código do produto, gerar o slug, e chamar a RPC atômica
// criar_produto_com_variacoes (produto + todas as variações numa
// transação só - se qualquer variação falhar, nada é criado).
export async function criarProdutoComoStaff(
  supabase: SupabaseServerClient,
  params: CriarProdutoParams
): Promise<CriarProdutoResultado> {
  let codigoFinal: string
  if (params.codigo_modo === 'automatico') {
    const prefixo = derivarPrefixo(params.produto.nome)
    if (!prefixo) {
      return { ok: false, error: 'Não foi possível gerar um código a partir do nome do produto.' }
    }
    const { data, error } = await supabase.rpc('gerar_codigo_produto_por_prefixo', { p_prefixo: prefixo })
    if (error) return { ok: false, error: error.message }
    codigoFinal = data as string
  } else if (params.codigo_modo === 'categoria') {
    const { data, error } = await supabase.rpc('gerar_codigo_produto', {
      p_category_id: params.produto.category_id,
    })
    if (error) return { ok: false, error: error.message }
    codigoFinal = data as string
  } else {
    if (!params.codigo_manual) {
      return { ok: false, error: 'Informe um código ou escolha um modo automático.' }
    }
    codigoFinal = params.codigo_manual
  }

  const slugFinal = slugify(params.produto.nome)
  if (!slugFinal) {
    return { ok: false, error: 'Não foi possível gerar uma URL válida a partir do nome.' }
  }

  const { data, error } = await supabase.rpc('criar_produto_com_variacoes', {
    p_produto: {
      category_id: params.produto.category_id,
      nome: params.produto.nome,
      slug: slugFinal,
      descricao: params.produto.descricao || null,
      unidade_venda_id: params.produto.unidade_venda_id,
      destaque: params.produto.destaque ?? false,
      ativo: params.produto.ativo ?? true,
      codigo: codigoFinal,
      codigo_visivel: params.produto.codigo_visivel ?? false,
    },
    p_variacoes: params.variacoes.map((v) => ({
      nome: v.nome || undefined,
      sku: v.sku || undefined,
      preco: v.preco,
      preco_promocional: v.preco_promocional ?? undefined,
      modo_estoque: v.modo_estoque,
      estoque_inicial: v.estoque_inicial ?? undefined,
      quantidade_minima_estoque: v.quantidade_minima_estoque,
      quantidade_minima_venda: v.quantidade_minima_venda,
    })),
    p_caracteristicas: params.caracteristicas ?? [],
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, produto: data as Tables<'products'> }
}

// Sanitiza a busca antes de montar o filtro .or() do PostgREST: virgula
// e parenteses tem significado especial na sintaxe do or-filter e
// quebrariam a query se vierem do texto digitado pelo usuario.
export function sanitizarBuscaProduto(busca: string) {
  return busca.replace(/[(),]/g, ' ').trim()
}

export type RemoverImagemResultado = { ok: true } | { ok: false; error: string }

// Extraída de DELETE /api/painel/produtos/[id]/imagens/[imageId] pra
// ser reaproveitada pela atualização em massa (Frente A, Inc 4,
// acao_foto=remover) - a MESMA lógica corrigida (Inc 3, 04/09/2026),
// nunca duplicada num segundo lugar que poderia divergir da correção.
// O chamador já confirmou que a linha existe (findError/not found é
// responsabilidade de quem chama, que também sabe o status HTTP certo
// pra cada caso) - aqui só a parte crítica: confirmar que o Storage
// REALMENTE removeu o arquivo (checando `data`, não só ausência de
// `error` - achado do Inc 3) antes de apagar a linha do banco.
export async function removerImagemComoStaff(
  supabase: SupabaseServerClient,
  params: { imageId: string; storagePath: string }
): Promise<RemoverImagemResultado> {
  const { data: removidos, error: removeError } = await supabase.storage
    .from('product-images')
    .remove([params.storagePath])
  const removeuDeVerdade = !removeError && (removidos ?? []).some((r) => r.name === params.storagePath)
  if (!removeuDeVerdade) {
    return { ok: false, error: 'Não foi possível excluir a imagem. Tente novamente.' }
  }

  const { error: deleteError } = await supabase.from('product_images').delete().eq('id', params.imageId)
  if (deleteError) {
    return {
      ok: false,
      error: 'A imagem foi removida do armazenamento, mas houve um erro ao atualizar o cadastro. Atualize a página.',
    }
  }

  return { ok: true }
}

export type FiltroProdutos = { status: string; busca: string; categoryId: string }

export type VariacaoEncontradaFiltro = {
  id: string
  nome: string
  sku: string | null
  bateu_sku: boolean
  bateu_nome: boolean
}

// Extraída de GET /api/painel/produtos (listagem) para ser reaproveitada
// pela exportação (Frente A, Inc 2) - garante que "o que a tela mostra"
// e "o que o export traz" usam EXATAMENTE a mesma query/filtro, nunca
// duas implementações que podem divergir.
export async function filtrarProdutosComoStaff(supabase: SupabaseServerClient, filtro: FiltroProdutos) {
  let query = supabase.from('products_com_status').select('*').order('nome', { ascending: true })

  if (filtro.status === 'ativos') query = query.eq('ativo', true)
  else if (filtro.status === 'inativos') query = query.eq('ativo', false)
  if (filtro.categoryId) query = query.eq('category_id', filtro.categoryId)

  // product_id -> variacoes que bateram na busca (so preenchido quando
  // ha busca) - permite a listagem mostrar QUAL variacao casou, nao so
  // que o produto casou. A exportacao ignora esse mapa, so usa `data`.
  const variacoesPorProduto = new Map<string, VariacaoEncontradaFiltro[]>()

  const busca = sanitizarBuscaProduto(filtro.busca)
  if (busca) {
    // Busca tambem por SKU/rotulo de variacao: acha os product_id que
    // batem numa query separada (product_variants nao e' exposto pela
    // view products_com_status, que agrega/agrupa as variacoes) e
    // inclui no .or() principal via id.in.(...). Nao filtra por
    // variacao ativa/inativa de proposito - staff pode estar
    // procurando o produto por um SKU ja inativado.
    const { data: variantMatches } = await supabase
      .from('product_variants')
      .select('id, product_id, nome, sku')
      .or(`sku.ilike.%${busca}%,nome.ilike.%${busca}%`)

    const buscaLower = busca.toLowerCase()
    for (const v of variantMatches ?? []) {
      const bateuSku = !!v.sku && v.sku.toLowerCase().includes(buscaLower)
      const bateuNome = !!v.nome && v.nome.toLowerCase().includes(buscaLower)
      if (!bateuSku && !bateuNome) continue
      const lista = variacoesPorProduto.get(v.product_id) ?? []
      lista.push({ id: v.id, nome: v.nome, sku: v.sku, bateu_sku: bateuSku, bateu_nome: bateuNome })
      variacoesPorProduto.set(v.product_id, lista)
    }
    const idsPorVariacao = [...variacoesPorProduto.keys()]

    const condicoes = [`nome.ilike.%${busca}%`, `codigo.ilike.%${busca}%`]
    if (idsPorVariacao.length > 0) {
      condicoes.push(`id.in.(${idsPorVariacao.join(',')})`)
    }
    query = query.or(condicoes.join(','))
  }

  const { data, error } = await query
  return { data, error, variacoesPorProduto }
}
