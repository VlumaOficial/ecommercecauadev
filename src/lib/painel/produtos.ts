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
