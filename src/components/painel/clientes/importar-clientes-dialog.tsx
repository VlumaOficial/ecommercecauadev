'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UploadIcon, FileDownIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { parseSpreadsheetFile } from '@/lib/importacao/parse-spreadsheet'
import { baixarCsv, baixarXlsx } from '@/lib/importacao/download'

// Fase 3, incremento 3 (carga em massa) - aprovado pelo PO em 04/09/2026.
const COLUNAS = ['email', 'nome', 'whatsapp', 'cidade'] as const
const LINHA_EXEMPLO = ['maria@exemplo.com', 'Maria Silva', '71999999999', 'Salvador']
const TAMANHO_LOTE = 25

type LinhaArquivo = { linha: number; email: string; nome: string; whatsapp: string; cidade: string }

type ResultadoLinha =
  | { linha: number; status: 'sucesso'; clienteId: string; emailEnviado: boolean | null }
  | { linha: number; status: 'erro'; motivo: string }

type Etapa = 'upload' | 'previa' | 'progresso' | 'resultado'

export function ImportarClientesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [todasLinhas, setTodasLinhas] = useState<Map<number, LinhaArquivo>>(new Map())
  const [linhasParaEnviar, setLinhasParaEnviar] = useState<LinhaArquivo[]>([])
  const [resultadosPrevios, setResultadosPrevios] = useState<ResultadoLinha[]>([])
  const [progresso, setProgresso] = useState({ enviados: 0, total: 0 })
  const [resultadosFinais, setResultadosFinais] = useState<ResultadoLinha[]>([])
  const [enviando, setEnviando] = useState(false)

  function resetar() {
    setEtapa('upload')
    setErroArquivo(null)
    setTodasLinhas(new Map())
    setLinhasParaEnviar([])
    setResultadosPrevios([])
    setProgresso({ enviados: 0, total: 0 })
    setResultadosFinais([])
    setEnviando(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleArquivoSelecionado(file: File) {
    setErroArquivo(null)
    const resultado = await parseSpreadsheetFile(file, COLUNAS)
    if ('erro' in resultado) {
      setErroArquivo(resultado.erro)
      return
    }

    const linhasBrutas: LinhaArquivo[] = resultado.linhas.map((obj, idx) => ({
      // +2: a linha 1 do arquivo é o cabeçalho, os dados começam na 2.
      linha: idx + 2,
      email: obj.email,
      nome: obj.nome,
      whatsapp: obj.whatsapp,
      cidade: obj.cidade,
    }))

    if (linhasBrutas.length === 0) {
      setErroArquivo('Nenhuma linha de dado encontrada no arquivo (só o cabeçalho).')
      return
    }

    // Duplicidade DENTRO do arquivo - detectada aqui, nunca chega ao
    // servidor (propriedade do arquivo inteiro, não de uma linha
    // isolada). Só compara e-mails não-vazios - e-mail vazio segue pro
    // servidor e vira "E-mail vazio.", nunca um falso "repetido".
    const primeiraOcorrencia = new Map<string, number>()
    const paraEnviar: LinhaArquivo[] = []
    const duplicadas: ResultadoLinha[] = []
    for (const linha of linhasBrutas) {
      const chave = linha.email.trim().toLowerCase()
      if (!chave) {
        paraEnviar.push(linha)
        continue
      }
      const primeira = primeiraOcorrencia.get(chave)
      if (primeira === undefined) {
        primeiraOcorrencia.set(chave, linha.linha)
        paraEnviar.push(linha)
      } else {
        duplicadas.push({
          linha: linha.linha,
          status: 'erro',
          motivo: `E-mail repetido no arquivo (já aparece na linha ${primeira}).`,
        })
      }
    }

    setTodasLinhas(new Map(linhasBrutas.map((l) => [l.linha, l])))
    setLinhasParaEnviar(paraEnviar)
    setResultadosPrevios(duplicadas)
    setEtapa('previa')
  }

  async function iniciarImportacao() {
    setEtapa('progresso')
    setEnviando(true)
    setProgresso({ enviados: 0, total: linhasParaEnviar.length })

    const acumulado: ResultadoLinha[] = [...resultadosPrevios]
    for (let i = 0; i < linhasParaEnviar.length; i += TAMANHO_LOTE) {
      const lote = linhasParaEnviar.slice(i, i + TAMANHO_LOTE)
      try {
        const resposta = await fetch('/api/painel/clientes/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linhas: lote }),
        })
        const corpo = await resposta.json().catch(() => null)
        if (!resposta.ok || !Array.isArray(corpo?.resultados)) {
          for (const linha of lote) {
            acumulado.push({ linha: linha.linha, status: 'erro', motivo: 'Falha de comunicação com o servidor. Tente importar estas linhas de novo.' })
          }
        } else {
          acumulado.push(...(corpo.resultados as ResultadoLinha[]))
        }
      } catch {
        for (const linha of lote) {
          acumulado.push({ linha: linha.linha, status: 'erro', motivo: 'Falha de comunicação com o servidor. Tente importar estas linhas de novo.' })
        }
      }
      setProgresso({ enviados: Math.min(i + TAMANHO_LOTE, linhasParaEnviar.length), total: linhasParaEnviar.length })
    }

    acumulado.sort((a, b) => a.linha - b.linha)
    setResultadosFinais(acumulado)
    setEnviando(false)
    setEtapa('resultado')
    queryClient.invalidateQueries({ queryKey: ['clientes'] })
  }

  function baixarLog() {
    const cabecalho = ['linha', 'email', 'nome', 'status', 'motivo']
    const linhas = resultadosFinais.map((r) => {
      const original = todasLinhas.get(r.linha)
      return [
        String(r.linha),
        original?.email ?? '',
        original?.nome ?? '',
        r.status === 'sucesso' ? 'sucesso' : 'erro',
        r.status === 'erro' ? r.motivo : '',
      ]
    })
    baixarCsv([cabecalho, ...linhas], 'log-importacao-clientes.csv')
  }

  const sucessos = resultadosFinais.filter((r) => r.status === 'sucesso')
  const erros = resultadosFinais.filter((r): r is Extract<ResultadoLinha, { status: 'erro' }> => r.status === 'erro')

  return (
    <Dialog
      open={open}
      onOpenChange={(novoAberto) => {
        if (enviando) return // trava fechar durante o envio dos lotes
        if (!novoAberto) resetar()
        onOpenChange(novoAberto)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar clientes</DialogTitle>
          <DialogDescription>
            {etapa === 'upload' && 'Baixe o modelo, preencha e selecione o arquivo para importar.'}
            {etapa === 'previa' && 'Confira o total de linhas antes de iniciar a importação.'}
            {etapa === 'progresso' && 'Importando os clientes válidos...'}
            {etapa === 'resultado' && 'Importação concluída.'}
          </DialogDescription>
        </DialogHeader>

        {etapa === 'upload' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => baixarCsv([[...COLUNAS], LINHA_EXEMPLO], 'modelo-clientes.csv')}
              >
                <FileDownIcon />
                Baixar modelo (CSV)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => baixarXlsx([[...COLUNAS], LINHA_EXEMPLO], 'modelo-clientes.xlsx', 'Clientes')}
              >
                <FileDownIcon />
                Baixar modelo (XLSX)
              </Button>
            </div>

            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleArquivoSelecionado(file)
                }}
              />
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                <UploadIcon />
                Selecionar arquivo (.csv ou .xlsx)
              </Button>
              {erroArquivo && <p className="mt-3 text-sm text-destructive">{erroArquivo}</p>}
            </div>
          </div>
        )}

        {etapa === 'previa' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              <strong>{linhasParaEnviar.length + resultadosPrevios.length}</strong> linha(s) encontrada(s) no arquivo.
              {resultadosPrevios.length > 0 && (
                <> <strong>{resultadosPrevios.length}</strong> já identificada(s) como e-mail repetido no próprio arquivo — serão reportadas como erro, sem tentar importar.</>
              )}
            </p>
            <p className="text-sm text-muted-foreground">Nenhum e-mail de senha será enviado nesta importação.</p>
          </div>
        )}

        {etapa === 'progresso' && (
          <div className="space-y-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progresso.total > 0 ? (progresso.enviados / progresso.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {progresso.enviados}/{progresso.total} processados...
            </p>
          </div>
        )}

        {etapa === 'resultado' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              <strong>{resultadosFinais.length}</strong> linha(s) processada(s) — <strong>{sucessos.length}</strong> com sucesso, <strong>{erros.length}</strong> com erro.
            </p>
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Nenhum e-mail de definição de senha foi enviado nesta importação — use &quot;Reenviar senha&quot; na ficha de cada cliente quando for liberar o acesso.
            </p>

            {erros.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {erros.map((r) => (
                      <TableRow key={r.linha}>
                        <TableCell>{r.linha}</TableCell>
                        <TableCell className="text-muted-foreground">{todasLinhas.get(r.linha)?.email || '—'}</TableCell>
                        <TableCell>{r.motivo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {etapa === 'upload' && (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {etapa === 'previa' && (
            <>
              <Button type="button" variant="outline" onClick={resetar}>
                Trocar arquivo
              </Button>
              <Button type="button" onClick={iniciarImportacao}>
                Iniciar importação
              </Button>
            </>
          )}
          {etapa === 'resultado' && (
            <>
              <Button type="button" variant="outline" onClick={baixarLog}>
                <FileDownIcon />
                Baixar log (CSV)
              </Button>
              <Button
                type="button"
                onClick={() => {
                  resetar()
                  onOpenChange(false)
                }}
              >
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
