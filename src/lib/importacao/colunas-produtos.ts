// Formato "uma linha por variação" da Frente A (Gestão de Catálogo em
// Escala) - as mesmas 15 colunas servem pra IMPORTAR (Inc 1) e EXPORTAR
// (Inc 2), critério de produto do PO ("o que é exportado tem que poder
// ser reimportado sem conversão"). Compartilhado entre os dois
// incrementos pra nunca divergir.
export const COLUNAS_PRODUTOS = [
  'identificador',
  'nome',
  'descricao',
  'categoria',
  'unidade',
  'codigo',
  'destaque',
  'codigo_visivel',
  'variacao_nome',
  'sku',
  'preco',
  'preco_promocional',
  'estoque',
  'quantidade_minima_estoque',
  'quantidade_minima_venda',
] as const

// Frente A, incremento 4 (atualização em massa via reimportação) -
// as MESMAS 15 colunas + `acao_foto` (16ª, vazio = não mexe / "remover"
// = apaga as fotos daquele SKU). Código e SKU são obrigatórios aqui
// (chave de casamento imutável) - diferente do Inc 1, onde eram
// opcionais (geração automática). Fluxo esperado: exportar (Inc 2),
// editar, reimportar aqui - não um modelo em branco.
export const COLUNAS_ATUALIZACAO_PRODUTOS = [...COLUNAS_PRODUTOS, 'acao_foto'] as const
