import * as XLSX from 'xlsx'

// Dispara o download de um Blob no browser - sem lib nova, mesmo
// mecanismo padrão (link temporário + click programático).
export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// BOM (﻿) garante que o Excel abra acentuação corretamente ao
// clicar duas vezes no CSV - mesma convenção assumida pelo parser
// (parse-spreadsheet.ts) na leitura. Separador ';' (convenção BR).
export function baixarCsv(linhas: string[][], nomeArquivo: string) {
  const csv = linhas.map((linha) => linha.map(escaparCampoCsv).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  baixarBlob(blob, nomeArquivo)
}

function escaparCampoCsv(valor: string): string {
  if (valor.includes(';') || valor.includes('"') || valor.includes('\n')) {
    return `"${valor.replace(/"/g, '""')}"`
  }
  return valor
}

export function baixarXlsx(linhas: string[][], nomeArquivo: string, nomeAba: string) {
  const planilha = XLSX.utils.aoa_to_sheet(linhas)
  const livro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(livro, planilha, nomeAba)
  XLSX.writeFile(livro, nomeArquivo)
}
