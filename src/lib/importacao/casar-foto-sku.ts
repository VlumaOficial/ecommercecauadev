// Frente A, incremento 3 (fotos por SKU) - aprovado pelo PO em
// 04/09/2026. `SKU.ext` = foto única/capa (ordem efetiva 0);
// `SKU-N.ext` = galeria, N é a ordem. Casa contra a lista REAL de SKUs
// do tenant (nunca um split ingênuo) porque o próprio SKU gerado pelo
// sistema já contém hífens (ex. `CIC-0042-PQ`) - tenta o nome inteiro
// primeiro, só remove um sufixo `-N` no final se o nome inteiro não
// bater com nenhum SKU conhecido. Case-insensitive (compara em
// maiúsculas, mas devolve o SKU na grafia REAL/canônica).
const EXTENSOES_VALIDAS = new Set(['jpg', 'jpeg', 'png', 'webp'])

export type MotivoErroCasamento = 'formato_invalido' | 'sku_nao_encontrado' | 'nome_fora_padrao'

export type ResultadoCasamento = { ok: true; sku: string; ordemEfetiva: number } | { ok: false; motivo: MotivoErroCasamento }

export function casarNomeArquivoComSku(nomeArquivo: string, skusPorChave: Map<string, string>): ResultadoCasamento {
  const pontoIdx = nomeArquivo.lastIndexOf('.')
  if (pontoIdx <= 0) return { ok: false, motivo: 'formato_invalido' }

  const extensao = nomeArquivo.slice(pontoIdx + 1).toLowerCase()
  if (!EXTENSOES_VALIDAS.has(extensao)) return { ok: false, motivo: 'formato_invalido' }

  const stem = nomeArquivo.slice(0, pontoIdx)

  // 1) Nome inteiro bate com um SKU real -> foto única/capa (ordem 0).
  const skuExato = skusPorChave.get(stem.toUpperCase())
  if (skuExato) return { ok: true, sku: skuExato, ordemEfetiva: 0 }

  // 2) Não bateu inteiro - tenta remover só o ÚLTIMO segmento (depois
  // do último hífen) como candidato a sufixo de galeria.
  const match = stem.match(/^(.+)-([^-]+)$/)
  if (match) {
    const [, base, sufixo] = match
    const skuBase = skusPorChave.get(base.toUpperCase())
    if (skuBase) {
      if (/^\d+$/.test(sufixo)) {
        return { ok: true, sku: skuBase, ordemEfetiva: parseInt(sufixo, 10) }
      }
      // O que sobrou do nome bate com um SKU real, mas o sufixo não é
      // um número limpo - nome "quase certo", mal formatado.
      return { ok: false, motivo: 'nome_fora_padrao' }
    }
  }

  return { ok: false, motivo: 'sku_nao_encontrado' }
}

const MENSAGENS_ERRO_CASAMENTO: Record<MotivoErroCasamento, string> = {
  formato_invalido: 'Formato de arquivo não suportado (use JPG, PNG ou WebP).',
  sku_nao_encontrado: 'Nenhum SKU cadastrado bate com este nome de arquivo.',
  nome_fora_padrao: 'O SKU foi reconhecido, mas o número no final do nome não é válido (ex.: use "SKU-1.jpg", não "SKU-01a.jpg").',
}

export function mensagemErroCasamento(motivo: MotivoErroCasamento): string {
  return MENSAGENS_ERRO_CASAMENTO[motivo]
}
