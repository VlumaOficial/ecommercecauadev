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
import type { Categoria } from '@/hooks/use-categorias'

// Frente A (Gestão de Catálogo em Escala), incremento 1 - aprovado pelo
// PO em 04/09/2026. Formato "uma linha por variação" (padrão Shopify/
// Nuvemshop): colunas de produto preenchidas na 1ª linha do grupo,
// colunas em branco nas linhas seguintes = herdam da 1ª. `identificador`
// agrupa - vazio = a linha é seu próprio produto de 1 variação.
const COLUNAS = [
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

const LINHAS_EXEMPLO = [
  // Produto de 1 variação - sem identificador.
  ['', 'Ração para Peixes Tropicais', 'Ração em flocos, embalagem de 1kg', 'Rações', 'Kg', '', 'não', 'não', 'Padrão', '', '29.90', '', '50', '5', '1'],
  // Produto de 2 variações - mesmo identificador nas duas linhas.
  ['AQ-VIDRO', 'Aquário de Vidro', 'Aquário retangular, vidro temperado', 'Aquários', 'Unidade', '', 'sim', 'sim', 'Pequeno (20L)', '', '89.90', '79.90', '10', '2', '1'],
  ['AQ-VIDRO', '', '', '', '', '', '', '', 'Grande (40L)', '', '149.90', '', '5', '2', '1'],
]

const TAMANHO_LOTE = 10

type LinhaArquivo = Record<(typeof COLUNAS)[number], string>

type VariacaoGrupo = {
  linha: number
  variacao_nome: string
  sku: string
  preco: string
  preco_promocional: string
  estoque: string
  quantidade_minima_estoque: string
  quantidade_minima_venda: string
}

type GrupoProduto = {
  linhas: number[]
  nome: string
  descricao: string
  categoria: string
  unidade: string
  codigo: string
  destaque: string
  codigo_visivel: string
  variacoes: VariacaoGrupo[]
}

type ResultadoGrupo =
  | { linhas: number[]; nome: string; status: 'sucesso'; produtoId: string; variacoesCriadas: number }
  | { linhas: number[]; nome: string; status: 'erro'; motivo: string }

type Etapa = 'upload' | 'previa' | 'progresso' | 'resultado'

function formatarLinhas(linhas: number[]): string {
  const ordenadas = [...linhas].sort((a, b) => a - b)
  const contigua = ordenadas.every((n, i) => i === 0 || n === ordenadas[i - 1] + 1)
  if (contigua && ordenadas.length > 1) return `${ordenadas[0]}-${ordenadas[ordenadas.length - 1]}`
  return ordenadas.join(', ')
}

function agruparLinhas(linhas: { linha: number; dados: LinhaArquivo }[]): GrupoProduto[] {
  const grupos = new Map<string, GrupoProduto>()
  const ordemChaves: string[] = []

  for (const { linha, dados } of linhas) {
    const identificador = dados.identificador.trim()
    const chave = identificador || `__solo_${linha}__`

    let grupo = grupos.get(chave)
    if (!grupo) {
      grupo = {
        linhas: [],
        nome: dados.nome,
        descricao: dados.descricao,
        categoria: dados.categoria,
        unidade: dados.unidade,
        codigo: dados.codigo,
        destaque: dados.destaque,
        codigo_visivel: dados.codigo_visivel,
        variacoes: [],
      }
      grupos.set(chave, grupo)
      ordemChaves.push(chave)
    }
    grupo.linhas.push(linha)
    grupo.variacoes.push({
      linha,
      variacao_nome: dados.variacao_nome,
      sku: dados.sku,
      preco: dados.preco,
      preco_promocional: dados.preco_promocional,
      estoque: dados.estoque,
      quantidade_minima_estoque: dados.quantidade_minima_estoque,
      quantidade_minima_venda: dados.quantidade_minima_venda,
    })
  }

  return ordemChaves.map((chave) => grupos.get(chave)!)
}

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function ImportarProdutosDialog({
  open,
  onOpenChange,
  categorias,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categorias: Categoria[]
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [gruposValidos, setGruposValidos] = useState<GrupoProduto[]>([])
  const [resultadosPrevios, setResultadosPrevios] = useState<ResultadoGrupo[]>([])
  const [categoriasNovas, setCategoriasNovas] = useState<string[]>([])
  const [totalVariacoes, setTotalVariacoes] = useState(0)
  const [progresso, setProgresso] = useState({ enviados: 0, total: 0 })
  const [resultadosFinais, setResultadosFinais] = useState<ResultadoGrupo[]>([])
  const [enviando, setEnviando] = useState(false)

  function resetar() {
    setEtapa('upload')
    setErroArquivo(null)
    setGruposValidos([])
    setResultadosPrevios([])
    setCategoriasNovas([])
    setTotalVariacoes(0)
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

    const linhasBrutas = resultado.linhas.map((obj, idx) => ({
      linha: idx + 2,
      dados: obj as LinhaArquivo,
    }))
    if (linhasBrutas.length === 0) {
      setErroArquivo('Nenhuma linha de dado encontrada no arquivo (só o cabeçalho).')
      return
    }

    const todosOsGrupos = agruparLinhas(linhasBrutas)

    // Duplicidade DENTRO do arquivo - propriedade do arquivo inteiro,
    // detectada no browser antes de qualquer chamada ao servidor. SKU
    // repetido (em qualquer variação, de qualquer produto) reprova o
    // PRODUTO INTEIRO dono da 2ª ocorrência (atomicidade por produto);
    // código repetido entre produtos, idem.
    const previos: ResultadoGrupo[] = []
    const reprovados = new Set<GrupoProduto>()

    const primeiraOcorrenciaSku = new Map<string, number>()
    for (const grupo of todosOsGrupos) {
      for (const v of grupo.variacoes) {
        const sku = v.sku.trim()
        if (!sku) continue
        const primeira = primeiraOcorrenciaSku.get(sku)
        if (primeira === undefined) {
          primeiraOcorrenciaSku.set(sku, v.linha)
        } else if (!reprovados.has(grupo)) {
          reprovados.add(grupo)
          previos.push({
            linhas: grupo.linhas,
            nome: grupo.nome.trim() || '(sem nome)',
            status: 'erro',
            motivo: `Não criado — linha ${v.linha}: SKU "${sku}" repetido no arquivo (já aparece na linha ${primeira}).`,
          })
        }
      }
    }

    const primeiraOcorrenciaCodigo = new Map<string, number>()
    for (const grupo of todosOsGrupos) {
      if (reprovados.has(grupo)) continue
      const codigo = grupo.codigo.trim()
      if (!codigo) continue
      const primeira = primeiraOcorrenciaCodigo.get(codigo)
      if (primeira === undefined) {
        primeiraOcorrenciaCodigo.set(codigo, grupo.linhas[0])
      } else {
        reprovados.add(grupo)
        previos.push({
          linhas: grupo.linhas,
          nome: grupo.nome.trim() || '(sem nome)',
          status: 'erro',
          motivo: `Não criado — código "${codigo}" repetido no arquivo (já usado no produto da linha ${primeira}).`,
        })
      }
    }

    const grupos = todosOsGrupos.filter((g) => !reprovados.has(g))

    const categoriasExistentes = new Set(categorias.map((c) => normalizar(c.nome)))
    const novas = new Set<string>()
    for (const g of grupos) {
      const nome = g.categoria.trim()
      if (nome && !categoriasExistentes.has(normalizar(nome))) novas.add(nome)
    }

    setGruposValidos(grupos)
    setResultadosPrevios(previos)
    setCategoriasNovas([...novas])
    setTotalVariacoes(todosOsGrupos.reduce((soma, g) => soma + g.variacoes.length, 0))
    setEtapa('previa')
  }

  async function iniciarImportacao() {
    setEtapa('progresso')
    setEnviando(true)
    setProgresso({ enviados: 0, total: gruposValidos.length })

    // ---- Passo 1: cria as categorias novas (sequencial, reaproveita
    // o mesmo endpoint do CRUD manual - nunca duplica a lógica de
    // prefixo/colisão aqui). ----
    const categoriasComFalha = new Set<string>()
    for (const nomeCategoria of categoriasNovas) {
      try {
        const resposta = await fetch('/api/painel/categorias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nomeCategoria, parent_id: null, descricao: '', ativo: true }),
        })
        if (!resposta.ok) categoriasComFalha.add(normalizar(nomeCategoria))
      } catch {
        categoriasComFalha.add(normalizar(nomeCategoria))
      }
    }

    const acumulado: ResultadoGrupo[] = [...resultadosPrevios]
    const paraEnviar: GrupoProduto[] = []
    for (const g of gruposValidos) {
      const categoriaNorm = normalizar(g.categoria.trim())
      if (categoriaNorm && categoriasComFalha.has(categoriaNorm)) {
        acumulado.push({
          linhas: g.linhas,
          nome: g.nome.trim() || '(sem nome)',
          status: 'erro',
          motivo: `Não criado — a categoria "${g.categoria.trim()}" não pôde ser criada automaticamente.`,
        })
      } else {
        paraEnviar.push(g)
      }
    }

    // ---- Passo 2: importa os produtos válidos, em lotes sequenciais. ----
    for (let i = 0; i < paraEnviar.length; i += TAMANHO_LOTE) {
      const lote = paraEnviar.slice(i, i + TAMANHO_LOTE)
      try {
        const resposta = await fetch('/api/painel/produtos/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grupos: lote }),
        })
        const corpo = await resposta.json().catch(() => null)
        if (!resposta.ok || !Array.isArray(corpo?.resultados)) {
          for (const g of lote) {
            acumulado.push({ linhas: g.linhas, nome: g.nome.trim() || '(sem nome)', status: 'erro', motivo: 'Falha de comunicação com o servidor. Tente importar este produto de novo.' })
          }
        } else {
          acumulado.push(...(corpo.resultados as ResultadoGrupo[]))
        }
      } catch {
        for (const g of lote) {
          acumulado.push({ linhas: g.linhas, nome: g.nome.trim() || '(sem nome)', status: 'erro', motivo: 'Falha de comunicação com o servidor. Tente importar este produto de novo.' })
        }
      }
      setProgresso({ enviados: Math.min(i + TAMANHO_LOTE, paraEnviar.length), total: paraEnviar.length })
    }

    acumulado.sort((a, b) => a.linhas[0] - b.linhas[0])
    setResultadosFinais(acumulado)
    setEnviando(false)
    setEtapa('resultado')
    queryClient.invalidateQueries({ queryKey: ['produtos'] })
    if (categoriasNovas.length > 0) queryClient.invalidateQueries({ queryKey: ['categorias'] })
  }

  function baixarLog() {
    const cabecalho = ['linhas', 'produto', 'status', 'variacoes_criadas', 'motivo']
    const linhas = resultadosFinais.map((r) => [
      formatarLinhas(r.linhas),
      r.nome,
      r.status === 'sucesso' ? 'sucesso' : 'erro',
      r.status === 'sucesso' ? String(r.variacoesCriadas) : '',
      r.status === 'erro' ? r.motivo : '',
    ])
    baixarCsv([cabecalho, ...linhas], 'log-importacao-produtos.csv')
  }

  const sucessos = resultadosFinais.filter((r): r is Extract<ResultadoGrupo, { status: 'sucesso' }> => r.status === 'sucesso')
  const erros = resultadosFinais.filter((r): r is Extract<ResultadoGrupo, { status: 'erro' }> => r.status === 'erro')
  const totalVariacoesCriadas = sucessos.reduce((soma, r) => soma + r.variacoesCriadas, 0)
  const categoriasNovasCriadas = categoriasNovas.length

  return (
    <Dialog
      open={open}
      onOpenChange={(novoAberto) => {
        if (enviando) return
        if (!novoAberto) resetar()
        onOpenChange(novoAberto)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar produtos</DialogTitle>
          <DialogDescription>
            {etapa === 'upload' && 'Baixe o modelo, preencha e selecione o arquivo para importar.'}
            {etapa === 'previa' && 'Confira o resumo antes de iniciar a importação.'}
            {etapa === 'progresso' && 'Importando os produtos válidos...'}
            {etapa === 'resultado' && 'Importação concluída.'}
          </DialogDescription>
        </DialogHeader>

        {etapa === 'upload' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => baixarCsv([[...COLUNAS], ...LINHAS_EXEMPLO], 'modelo-produtos.csv')}
              >
                <FileDownIcon />
                Baixar modelo (CSV)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => baixarXlsx([[...COLUNAS], ...LINHAS_EXEMPLO], 'modelo-produtos.xlsx', 'Produtos')}
              >
                <FileDownIcon />
                Baixar modelo (XLSX)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Uma linha por variação. Preencha o <strong>identificador</strong> só quando o produto tiver mais de uma
              variação — linhas com o mesmo identificador viram o mesmo produto.
            </p>

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
              <strong>{gruposValidos.length + resultadosPrevios.length}</strong> produto(s) encontrado(s) no arquivo
              (<strong>{totalVariacoes}</strong> variação(ões) no total).
              {resultadosPrevios.length > 0 && (
                <> <strong>{resultadosPrevios.length}</strong> já identificado(s) com SKU ou código repetido no próprio arquivo — serão reportados como erro, sem tentar importar.</>
              )}
            </p>
            {categoriasNovas.length > 0 && (
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                Vou criar <strong>{categoriasNovas.length}</strong> categoria(s) nova(s): {categoriasNovas.join(', ')}
              </p>
            )}
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
              {progresso.enviados}/{progresso.total} produtos processados...
            </p>
          </div>
        )}

        {etapa === 'resultado' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              <strong>{sucessos.length}</strong> produto(s) criado(s) (<strong>{totalVariacoesCriadas}</strong> variação(ões)),{' '}
              <strong>{erros.length}</strong> com erro
              {categoriasNovasCriadas > 0 && <>, <strong>{categoriasNovasCriadas}</strong> categoria(s) nova(s) criada(s)</>}.
            </p>

            {erros.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linhas</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {erros.map((r) => (
                      <TableRow key={formatarLinhas(r.linhas)}>
                        <TableCell>{formatarLinhas(r.linhas)}</TableCell>
                        <TableCell className="text-muted-foreground">{r.nome}</TableCell>
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
