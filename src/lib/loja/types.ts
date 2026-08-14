// Shapes usados pela Vitrine ((loja)/**), espelhando exatamente o
// retorno das RPCs publicas da migration 028 (get_public_*). Mantidos
// separados de src/types/database.ts porque get_public_product_detail
// retorna jsonb livre (a RPC monta o objeto no banco) - nao ha Row
// gerado pra validar contra.

export type StoreSettingsPublico = {
  nome: string
  loja_aberta: boolean
  pedidos_abertos: boolean
  mensagem_loja_fechada: string | null
  mensagem_pedidos_fechados: string | null
  valor_minimo_pedido: number
}

export type CategoriaPublica = {
  id: string
  nome: string
  slug: string
  parent_id: string | null
  ordem: number
}

export type ProdutoPublico = {
  id: string
  nome: string
  slug: string
  descricao: string | null
  category_id: string
  destaque: boolean
  novidade: boolean
  em_promocao: boolean
  esgotado: boolean
  preco_a_partir_de: number | null
  preco_varia: boolean
  codigo: string | null
  imagem_principal: string | null
  unidade_venda: string
}

export type ProdutoDetalheImagem = {
  storage_path: string
  alt_text: string | null
  principal: boolean
  variant_id: string | null
}

export type ProdutoDetalheCaracteristica = {
  rotulo: string
  valor: string
}

export type ProdutoDetalheVariacao = {
  id: string
  nome: string
  preco: number
  preco_promocional: number | null
  disponivel: boolean
  quantidade_minima_venda: number
}

export type ProdutoDetalhe = {
  id: string
  nome: string
  slug: string
  descricao: string | null
  category_id: string
  destaque: boolean
  codigo: string | null
  unidade_venda: string
  imagens: ProdutoDetalheImagem[]
  caracteristicas: ProdutoDetalheCaracteristica[]
  variacoes: ProdutoDetalheVariacao[]
}
