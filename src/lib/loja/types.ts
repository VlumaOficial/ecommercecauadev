// Shapes usados pela Vitrine ((loja)/**), espelhando exatamente o
// retorno das RPCs publicas da migration 028 (get_public_*). Mantidos
// separados de src/types/database.ts porque get_public_product_detail
// retorna jsonb livre (a RPC monta o objeto no banco) - nao ha Row
// gerado pra validar contra.

export type SeloConfianca = {
  titulo: string
  subtitulo: string
  icone: string
  ativo: boolean
}

export type StoreSettingsPublico = {
  nome: string
  loja_aberta: boolean
  pedidos_abertos: boolean
  mensagem_loja_fechada: string | null
  mensagem_pedidos_fechados: string | null
  valor_minimo_pedido: number
  // Vitrine Fase 1 Etapa 3 (migration 030) - banner/selos/whatsapp/
  // identidade editaveis, com default = valor hoje hardcoded.
  banner_titulo: string
  banner_subtitulo: string
  banner_botao_texto: string
  banner_botao_href: string
  banner_tipo_fundo: 'cor' | 'imagem'
  banner_cor_fundo: string
  banner_imagem_path: string | null
  selos: SeloConfianca[]
  whatsapp_numero: string | null
  whatsapp_mensagem: string
  cor_principal: string
  // Vitrine Fase 1 Etapa 4 (migration 031) - null = usa o arquivo
  // estatico public/brand/logocp-icone.png (ver urlLogoLoja()).
  logo_path: string | null
  // Fase 2, incremento 2 (migration 036) - controla se o /cadastro
  // publico mostra o formulario de autocadastro de cliente.
  permite_autocadastro: boolean
}

// Cidade de entrega ativa, espelhando get_public_delivery_cities
// (migration 032, Fase 2 incremento 1).
export type CidadeEntregaPublica = {
  id: string
  nome: string
  uf: string | null
  ponto_entrega: string | null
  horario: string | null
  observacoes: string | null
  ordem: number
}

// Campos editaveis da identidade da vitrine - mesmo formato usado no
// rascunho (store_settings.rascunho, migration 031) e no retorno das
// RPCs de staff/preview. Subconjunto de StoreSettingsPublico (sem
// nome/loja_aberta/etc., que sao operacionais e nao passam por
// rascunho/publicar).
export type ConfiguracaoVitrineCampos = {
  logo_path: string | null
  banner_titulo: string
  banner_subtitulo: string
  banner_botao_texto: string
  banner_botao_href: string
  banner_tipo_fundo: 'cor' | 'imagem'
  banner_cor_fundo: string
  banner_imagem_path: string | null
  selos: SeloConfianca[]
  whatsapp_numero: string | null
  whatsapp_mensagem: string
  cor_principal: string
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
