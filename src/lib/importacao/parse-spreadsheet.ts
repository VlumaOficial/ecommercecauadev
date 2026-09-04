import * as XLSX from 'xlsx'

// Genérico o bastante pra ser reaproveitado pela Frente A (Catálogo em
// Escala, importação de produtos) quando chegar a vez - só o desenho de
// colunas muda por feature, o parsing em si (CSV+XLSX, encoding,
// separador) não.

export type LinhaBruta = Record<string, string>

const COMBINACOES_DIACRITICO = /[\u0300-\u036f]/g

function normalizarCabecalho(v: string) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(COMBINACOES_DIACRITICO, '')
    .trim()
    .toLowerCase()
}

// CSV gerado por planilha em locale BR (Excel) tipicamente vem em
// UTF-8 com BOM; se o arquivo foi salvo noutro programa/locale, pode vir
// em Latin-1/CP1252 sem BOM. Sem biblioteca de detecção de charset
// (over-engineering pro caso de uso) - heurística: decodifica como UTF-8
// primeiro, se aparecer caractere de substituição (sinal de bytes
// inválidos pra UTF-8), tenta de novo como Windows-1252.
function decodificarTexto(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const semBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.slice(3) : bytes
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(semBom)
  if (utf8.includes('�')) {
    return new TextDecoder('windows-1252').decode(semBom)
  }
  return utf8
}

function detectarSeparadorCsv(primeiraLinha: string): string {
  // Convenção BR (Excel) usa ';' - só cai pra ',' se não houver nenhum
  // ';' na linha de cabeçalho.
  return primeiraLinha.includes(';') ? ';' : ','
}

export type ResultadoParse = { linhas: LinhaBruta[] } | { erro: string }

// Lê um arquivo .csv ou .xlsx e devolve um objeto por linha de dado
// (cabeçalho normalizado -> valor), na ordem em que aparecem no arquivo.
// Colunas exigidas são checadas pelo chamador (esta função é agnóstica
// de "quais colunas", cada feature declara as suas).
export async function parseSpreadsheetFile(
  file: File,
  colunasEsperadas: readonly string[]
): Promise<ResultadoParse> {
  const buffer = await file.arrayBuffer()
  const isCsv = file.name.toLowerCase().endsWith('.csv')

  let planilha: XLSX.WorkBook
  if (isCsv) {
    const texto = decodificarTexto(buffer)
    const separador = detectarSeparadorCsv(texto.split(/\r?\n/, 1)[0] ?? '')
    planilha = XLSX.read(texto, { type: 'string', FS: separador })
  } else {
    planilha = XLSX.read(buffer, { type: 'array' })
  }

  const primeiraAba = planilha.Sheets[planilha.SheetNames[0]]
  if (!primeiraAba) return { erro: 'Não foi possível ler o arquivo — verifique se ele não está vazio ou corrompido.' }

  const linhasBrutas = XLSX.utils.sheet_to_json<string[]>(primeiraAba, { header: 1, raw: false, defval: '' })
  if (linhasBrutas.length === 0) return { erro: 'O arquivo está vazio.' }

  const cabecalho = linhasBrutas[0].map(normalizarCabecalho)
  const indicePorColuna = colunasEsperadas.map((coluna) => cabecalho.indexOf(coluna))
  const faltando = colunasEsperadas.filter((_, i) => indicePorColuna[i] === -1)
  if (faltando.length > 0) {
    return {
      erro: `O arquivo não tem a(s) coluna(s) esperada(s): ${faltando.join(', ')}. Baixe o modelo novamente e não renomeie o cabeçalho.`,
    }
  }

  const linhas: LinhaBruta[] = []
  for (let i = 1; i < linhasBrutas.length; i++) {
    const linha = linhasBrutas[i]
    const vazia = !linha || linha.every((c) => !String(c ?? '').trim())
    if (vazia) continue // linha em branco no meio/fim do arquivo - ignora, sem entrar no log

    const objeto: LinhaBruta = {}
    colunasEsperadas.forEach((coluna, idx) => {
      objeto[coluna] = String(linha[indicePorColuna[idx]] ?? '').trim()
    })
    linhas.push(objeto)
  }

  return { linhas }
}
