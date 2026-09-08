'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UploadIcon, FileDownIcon, AlertTriangleIcon } from 'lucide-react'
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
import { COLUNAS_ATUALIZACAO_PRODUTOS } from '@/lib/importacao/colunas-produtos'
import { formatarMoeda } from '@/lib/utils'

// Frente A (Gestão de Catálogo em Escala), incremento 4 - aprovado pelo
// PO em 08/09/2026. Diferente dos outros incrementos: aqui é
// ATUALIZAÇÃO de dado real, não criação - por isso o preview é mais
// forte (mostra o diff de verdade antes de aplicar, não só uma
// contagem de linhas) e o fluxo esperado é Exportar (Inc 2) → editar
// no Excel → Reimportar aqui, não um modelo em branco.
const COLUNAS = COLUNAS_ATUALIZACAO_PRODUTOS

// Dois produtos de exemplo, cada um sua própria linha (sem
// identificador) - ilustram uma ENTRADA de estoque com troca de preço
// e uma SAÍDA de estoque com remoção de foto. Um arquivo de verdade
// normalmente vem de uma exportação real (Exportar → editar →
// Reimportar), não deste modelo em branco - ele só documenta as colunas.
const LINHAS_EXEMPLO = [
  ['', 'Ração para Peixes Tropicais', 'Ração em flocos, embalagem de 1kg', 'Rações', 'Kg', 'RAC0001', 'não', 'não', 'Padrão', 'RAC0001-PADR', '34.90', '', '30', '5', '1', ''],
  ['', '', '', '', '', 'AQ0002', '', '', '', 'AQ0002-PADR', '', '', '-5', '', '', 'remover'],
]

const TAMANHO_LOTE = 10

type LinhaArquivo = Record<(typeof COLUNAS)[number], string>

type VariacaoGrupo = {
  linha: number
  sku: string
  preco: string
  preco_promocional: string
  estoque: string
  acao_foto: string
}

type GrupoAtualizacao = {
  linhas: number[]
  codigo: string
  nome: string
  descricao: string
  variacoes: VariacaoGrupo[]
}

type EstadoAtualVariacao = { sku: string | null; preco: number; preco_promocional: number | null; saldo_estoque: number; num_fotos: number }
type EstadoAtualProduto = { codigo: string; nome: string | null; descricao: string | null; variacoes: EstadoAtualVariacao[] }

type DiffVariacao = {
  sku: string
  precoTexto?: string
  promoTexto?: string
  estoqueTexto?: string
  ehSaida: boolean
  fotosARemover: number
}

type DiffProduto = {
  grupo: GrupoAtualizacao
  nomeAtual: string
  camposAlterados: string[]
  variacoesDiff: DiffVariacao[]
}

type GrupoPulado = { linhas: number[]; codigo: string; nome: string; motivo: string }

type ResultadoGrupo =
  | { linhas: number[]; codigo: string; nome: string; status: 'sucesso'; fotosRemovidas: number; falhaRemocaoFoto?: string }
  | { linhas: number[]; codigo: string; nome: string; status: 'erro'; motivo: string }

type Etapa = 'upload' | 'previa' | 'progresso' | 'resultado'

function formatarLinhas(linhas: number[]): string {
  const ordenadas = [...linhas].sort((a, b) => a - b)
  const contigua = ordenadas.every((n, i) => i === 0 || n === ordenadas[i - 1] + 1)
  if (contigua && ordenadas.length > 1) return `${ordenadas[0]}-${ordenadas[ordenadas.length - 1]}`
  return ordenadas.join(', ')
}

// Aceita "12.50" e o formato BR "12,50"; estoque pode vir negativo
// (saída). Mesma lógica usada no servidor (nunca confiada sozinha -
// o servidor revalida tudo de novo).
function paraNumero(v: string): number | null {
  const limpo = v.trim()
  if (!limpo) return null
  const normalizado = /,\d{1,2}$/.test(limpo) && !limpo.includes('.') ? limpo.replace(',', '.') : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

function paraInteiro(v: string): number | null {
  const n = paraNumero(v)
  return n === null ? null : Math.trunc(n)
}

// Agrupa por `identificador` (herdando código/nome/descrição da 1ª
// linha do grupo) - MESMA convenção do Inc 1, nunca por `codigo` linha
// a linha: a exportação (Inc 2) só preenche codigo/nome/descrição na
// 1ª linha de cada grupo (colunas em branco nas seguintes = herdam),
// exatamente como identificador/nome/categoria no Inc 1 - group por
// código exigiria a célula preenchida em toda linha, o que quebraria
// justamente o arquivo real que veio de uma exportação.
function agruparLinhas(linhas: { linha: number; dados: LinhaArquivo }[]): GrupoAtualizacao[] {
  const grupos = new Map<string, GrupoAtualizacao>()
  const ordemChaves: string[] = []

  for (const { linha, dados } of linhas) {
    const identificador = dados.identificador.trim()
    const chave = identificador || `__solo_${linha}__`

    let grupo = grupos.get(chave)
    if (!grupo) {
      grupo = { linhas: [], codigo: dados.codigo, nome: dados.nome, descricao: dados.descricao, variacoes: [] }
      grupos.set(chave, grupo)
      ordemChaves.push(chave)
    }
    grupo.linhas.push(linha)
    grupo.variacoes.push({
      linha,
      sku: dados.sku,
      preco: dados.preco,
      preco_promocional: dados.preco_promocional,
      estoque: dados.estoque,
      acao_foto: dados.acao_foto,
    })
  }

  return ordemChaves.map((c) => grupos.get(c)!)
}

export function AtualizarProdutosDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [carregandoPrevia, setCarregandoPrevia] = useState(false)
  const [diffsValidos, setDiffsValidos] = useState<DiffProduto[]>([])
  const [pulados, setPulados] = useState<GrupoPulado[]>([])
  const [progresso, setProgresso] = useState({ enviados: 0, total: 0 })
  const [resultadosFinais, setResultadosFinais] = useState<ResultadoGrupo[]>([])
  const [enviando, setEnviando] = useState(false)

  function resetar() {
    setEtapa('upload')
    setErroArquivo(null)
    setCarregandoPrevia(false)
    setDiffsValidos([])
    setPulados([])
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

    const linhasBrutas = resultado.linhas.map((obj, idx) => ({ linha: idx + 2, dados: obj as LinhaArquivo }))
    if (linhasBrutas.length === 0) {
      setErroArquivo('Nenhuma linha de dado encontrada no arquivo (só o cabeçalho).')
      return
    }

    const todosOsGrupos = agruparLinhas(linhasBrutas)
    const puladosLocais: GrupoPulado[] = []
    const grupos: GrupoAtualizacao[] = []
    for (const g of todosOsGrupos) {
      const codigo = g.codigo.trim()
      if (!codigo) {
        puladosLocais.push({ linhas: g.linhas, codigo: '', nome: g.nome.trim() || '(sem código)', motivo: 'Código do produto vazio — obrigatório na atualização.' })
      } else {
        grupos.push({ ...g, codigo })
      }
    }

    if (grupos.length === 0) {
      setPulados(puladosLocais)
      setDiffsValidos([])
      setEtapa('previa')
      return
    }

    setCarregandoPrevia(true)
    let estadoPorCodigo = new Map<string, EstadoAtualProduto>()
    try {
      const codigos = grupos.map((g) => g.codigo)
      const resposta = await fetch(`/api/painel/produtos/estado-atual?codigos=${encodeURIComponent(codigos.join(','))}`)
      const corpo = await resposta.json().catch(() => null)
      if (resposta.ok && Array.isArray(corpo?.produtos)) {
        estadoPorCodigo = new Map((corpo.produtos as EstadoAtualProduto[]).map((p) => [p.codigo, p]))
      }
    } catch {
      // erro de rede: todos os grupos entram como "não foi possível verificar" abaixo
    }

    const diffs: DiffProduto[] = []
    for (const grupo of grupos) {
      const estado = estadoPorCodigo.get(grupo.codigo)
      if (!estado) {
        puladosLocais.push({ linhas: grupo.linhas, codigo: grupo.codigo, nome: grupo.nome.trim() || grupo.codigo, motivo: `Código "${grupo.codigo}" não encontrado — a atualização não cria produtos novos.` })
        continue
      }

      const variacoesPorSku = new Map(estado.variacoes.map((v) => [v.sku ?? '', v]))
      let grupoInvalido: string | null = null
      const variacoesDiff: DiffVariacao[] = []

      for (const v of grupo.variacoes) {
        const sku = v.sku.trim()
        if (!sku) {
          grupoInvalido = `Linha ${v.linha}: SKU vazio.`
          break
        }
        const atual = variacoesPorSku.get(sku)
        if (!atual) {
          grupoInvalido = `SKU "${sku}" não encontrado (linha ${v.linha}).`
          break
        }

        let precoTexto: string | undefined
        if (v.preco.trim()) {
          const novo = paraNumero(v.preco)
          if (novo === null) { grupoInvalido = `Linha ${v.linha}: preço inválido.`; break }
          if (novo !== atual.preco) precoTexto = `${formatarMoeda(atual.preco)} → ${formatarMoeda(novo)}`
        }

        let promoTexto: string | undefined
        if (v.preco_promocional.trim()) {
          const novo = paraNumero(v.preco_promocional)
          if (novo === null) { grupoInvalido = `Linha ${v.linha}: preço promocional inválido.`; break }
          if (novo !== atual.preco_promocional) promoTexto = `${formatarMoeda(atual.preco_promocional)} → ${formatarMoeda(novo)}`
        }

        let estoqueTexto: string | undefined
        let ehSaida = false
        if (v.estoque.trim()) {
          const entrada = paraInteiro(v.estoque)
          if (entrada === null) { grupoInvalido = `Linha ${v.linha}: quantidade de estoque inválida.`; break }
          if (entrada !== 0) {
            ehSaida = entrada < 0
            const novoSaldo = atual.saldo_estoque + entrada
            estoqueTexto = ehSaida
              ? `⚠ SAÍDA de ${Math.abs(entrada)} un: ${atual.saldo_estoque} → ${novoSaldo}`
              : `${atual.saldo_estoque} → ${novoSaldo} (+${entrada})`
          }
        }

        const acaoFoto = v.acao_foto.trim().toLowerCase()
        if (acaoFoto && acaoFoto !== 'remover') { grupoInvalido = `Linha ${v.linha}: ação de foto "${v.acao_foto}" não reconhecida.`; break }
        const fotosARemover = acaoFoto === 'remover' ? atual.num_fotos : 0

        variacoesDiff.push({ sku, precoTexto, promoTexto, estoqueTexto, ehSaida, fotosARemover })
      }

      if (grupoInvalido) {
        puladosLocais.push({ linhas: grupo.linhas, codigo: grupo.codigo, nome: grupo.nome.trim() || grupo.codigo, motivo: grupoInvalido })
        continue
      }

      const camposAlterados: string[] = []
      const nomeNovo = grupo.nome.trim()
      if (nomeNovo && nomeNovo !== (estado.nome ?? '')) camposAlterados.push(`nome: "${estado.nome}" → "${nomeNovo}"`)
      const descricaoNova = grupo.descricao.trim()
      if (descricaoNova && descricaoNova !== (estado.descricao ?? '')) camposAlterados.push('descrição alterada')

      diffs.push({ grupo, nomeAtual: estado.nome ?? grupo.codigo, camposAlterados, variacoesDiff })
    }

    setDiffsValidos(diffs)
    setPulados(puladosLocais)
    setCarregandoPrevia(false)
    setEtapa('previa')
  }

  async function aplicarAtualizacao() {
    setEtapa('progresso')
    setEnviando(true)
    setProgresso({ enviados: 0, total: diffsValidos.length })

    const acumulado: ResultadoGrupo[] = pulados.map((p) => ({ linhas: p.linhas, codigo: p.codigo, nome: p.nome, status: 'erro', motivo: p.motivo }))
    const paraEnviar = diffsValidos.map((d) => d.grupo)

    for (let i = 0; i < paraEnviar.length; i += TAMANHO_LOTE) {
      const lote = paraEnviar.slice(i, i + TAMANHO_LOTE)
      try {
        const resposta = await fetch('/api/painel/produtos/atualizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grupos: lote }),
        })
        const corpo = await resposta.json().catch(() => null)
        if (!resposta.ok || !Array.isArray(corpo?.resultados)) {
          for (const g of lote) {
            acumulado.push({ linhas: g.linhas, codigo: g.codigo, nome: g.nome.trim() || g.codigo, status: 'erro', motivo: 'Falha de comunicação com o servidor. Tente atualizar este produto de novo.' })
          }
        } else {
          acumulado.push(...(corpo.resultados as ResultadoGrupo[]))
        }
      } catch {
        for (const g of lote) {
          acumulado.push({ linhas: g.linhas, codigo: g.codigo, nome: g.nome.trim() || g.codigo, status: 'erro', motivo: 'Falha de comunicação com o servidor. Tente atualizar este produto de novo.' })
        }
      }
      setProgresso({ enviados: Math.min(i + TAMANHO_LOTE, paraEnviar.length), total: paraEnviar.length })
    }

    acumulado.sort((a, b) => a.linhas[0] - b.linhas[0])
    setResultadosFinais(acumulado)
    setEnviando(false)
    setEtapa('resultado')
    queryClient.invalidateQueries({ queryKey: ['produtos'] })
  }

  function baixarLog() {
    const cabecalho = ['linhas', 'codigo', 'produto', 'status', 'fotos_removidas', 'motivo']
    const linhas = resultadosFinais.map((r) => [
      formatarLinhas(r.linhas),
      r.codigo,
      r.nome,
      r.status === 'sucesso' ? 'sucesso' : 'erro',
      r.status === 'sucesso' ? String(r.fotosRemovidas) : '',
      r.status === 'sucesso' ? (r.falhaRemocaoFoto ?? '') : r.motivo,
    ])
    baixarCsv([cabecalho, ...linhas], 'log-atualizacao-produtos.csv')
  }

  const sucessos = resultadosFinais.filter((r): r is Extract<ResultadoGrupo, { status: 'sucesso' }> => r.status === 'sucesso')
  const erros = resultadosFinais.filter((r): r is Extract<ResultadoGrupo, { status: 'erro' }> => r.status === 'erro')
  const totalFotosRemovidas = sucessos.reduce((soma, r) => soma + r.fotosRemovidas, 0)
  const sucessosComFalhaFoto = sucessos.filter((r) => r.falhaRemocaoFoto)
  const temSaida = diffsValidos.some((d) => d.variacoesDiff.some((v) => v.ehSaida))
  const totalComAlgumaMudanca = diffsValidos.filter(
    (d) => d.camposAlterados.length > 0 || d.variacoesDiff.some((v) => v.precoTexto || v.promoTexto || v.estoqueTexto || v.fotosARemover > 0)
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(novoAberto) => {
        if (enviando) return
        if (!novoAberto) resetar()
        onOpenChange(novoAberto)
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Atualizar produtos em massa</DialogTitle>
          <DialogDescription>
            {etapa === 'upload' && 'Exporte o catálogo, edite os valores no Excel e reimporte aqui pra atualizar em massa.'}
            {etapa === 'previa' && 'Confira exatamente o que vai mudar antes de aplicar.'}
            {etapa === 'progresso' && 'Aplicando a atualização...'}
            {etapa === 'resultado' && 'Atualização concluída.'}
          </DialogDescription>
        </DialogHeader>

        {etapa === 'upload' && (
          <div className="space-y-4">
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
              Esta tela <strong>atualiza produtos que já existem</strong> (casando por código do produto + SKU da
              variação) — não cria produtos novos. O fluxo esperado é: <strong>Exportar</strong> o catálogo (botão
              "Exportar" da tela de Produtos), editar os valores que quer mudar no Excel, e reimportar o mesmo
              arquivo aqui.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => baixarCsv([[...COLUNAS], ...LINHAS_EXEMPLO], 'modelo-atualizacao-produtos.csv')}>
                <FileDownIcon />
                Baixar modelo de referência (CSV)
              </Button>
              <Button type="button" variant="outline" onClick={() => baixarXlsx([[...COLUNAS], ...LINHAS_EXEMPLO], 'modelo-atualizacao-produtos.xlsx', 'Atualização')}>
                <FileDownIcon />
                Baixar modelo de referência (XLSX)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Código e SKU são obrigatórios (é como o sistema encontra o produto/variação a atualizar) e nunca são
              alterados. Célula em branco = não mexe naquele campo. Estoque preenchido é somado ao saldo atual
              (positivo = entrada, negativo = saída) — nunca substitui o saldo. <code>acao_foto</code> = "remover"
              apaga as fotos daquele SKU; em branco não mexe nas fotos.
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
              <Button type="button" variant="outline" disabled={carregandoPrevia} onClick={() => inputRef.current?.click()}>
                <UploadIcon />
                {carregandoPrevia ? 'Verificando produtos...' : 'Selecionar arquivo (.csv ou .xlsx)'}
              </Button>
              {erroArquivo && <p className="mt-3 text-sm text-destructive">{erroArquivo}</p>}
            </div>
          </div>
        )}

        {etapa === 'previa' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-sm text-foreground">
              <strong>{totalComAlgumaMudanca.length}</strong> produto(s) serão atualizados
              {pulados.length > 0 && <>, <strong>{pulados.length}</strong> serão pulados</>}.
            </p>

            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              ⚠ Reimportar este arquivo de novo somará o estoque novamente — cada entrada/saída é cumulativa, não um
              valor absoluto.
            </p>

            {temSaida && (
              <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangleIcon className="size-4 shrink-0" />
                Este arquivo contém <strong>saídas de estoque</strong> (valores negativos) — elas reduzem o saldo
                real, revise com atenção antes de confirmar.
              </p>
            )}

            {pulados.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-foreground">Produtos que serão pulados:</p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linhas</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pulados.map((p) => (
                        <TableRow key={`${formatarLinhas(p.linhas)}-${p.codigo}`}>
                          <TableCell>{formatarLinhas(p.linhas)}</TableCell>
                          <TableCell className="text-muted-foreground">{p.nome}</TableCell>
                          <TableCell>{p.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {totalComAlgumaMudanca.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-foreground">O que vai mudar:</p>
                <div className="space-y-3">
                  {totalComAlgumaMudanca.map((d) => (
                    <div key={d.grupo.codigo} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium text-foreground">
                        {d.nomeAtual} <span className="text-xs text-muted-foreground">({d.grupo.codigo})</span>
                      </p>
                      {d.camposAlterados.length > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                          {d.camposAlterados.map((c) => <li key={c}>{c}</li>)}
                        </ul>
                      )}
                      {d.variacoesDiff.map((v) => (
                        (v.precoTexto || v.promoTexto || v.estoqueTexto || v.fotosARemover > 0) && (
                          <div key={v.sku} className="mt-1 border-t border-border/60 pt-1 text-xs">
                            <span className="font-medium">{v.sku}:</span>{' '}
                            {v.precoTexto && <span className="mr-2">preço {v.precoTexto}</span>}
                            {v.promoTexto && <span className="mr-2">promocional {v.promoTexto}</span>}
                            {v.estoqueTexto && (
                              <span className={v.ehSaida ? 'font-medium text-amber-700' : ''}>{v.estoqueTexto}</span>
                            )}
                            {v.fotosARemover > 0 && (
                              <span className="ml-2 text-destructive">vai remover {v.fotosARemover} foto(s)</span>
                            )}
                          </div>
                        )
                      ))}
                    </div>
                  ))}
                </div>
              </div>
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
            <p className="text-center text-sm text-muted-foreground">{progresso.enviados}/{progresso.total} produtos processados...</p>
          </div>
        )}

        {etapa === 'resultado' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              <strong>{sucessos.length}</strong> produto(s) atualizado(s), <strong>{erros.length}</strong> com erro
              {totalFotosRemovidas > 0 && <>, <strong>{totalFotosRemovidas}</strong> foto(s) removida(s)</>}.
            </p>

            {sucessosComFalhaFoto.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-medium">Dados/estoque atualizados, mas houve falha ao remover foto:</p>
                <ul className="mt-1 list-disc pl-5">
                  {sucessosComFalhaFoto.map((r) => <li key={r.codigo}>{r.nome}: {r.falhaRemocaoFoto}</li>)}
                </ul>
              </div>
            )}

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
                      <TableRow key={`${formatarLinhas(r.linhas)}-${r.codigo}`}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          {etapa === 'previa' && (
            <>
              <Button type="button" variant="outline" onClick={resetar}>Trocar arquivo</Button>
              <Button type="button" disabled={totalComAlgumaMudanca.length === 0} onClick={aplicarAtualizacao}>
                Confirmar e aplicar
              </Button>
            </>
          )}
          {etapa === 'resultado' && (
            <>
              <Button type="button" variant="outline" onClick={baixarLog}>
                <FileDownIcon />
                Baixar log (CSV)
              </Button>
              <Button type="button" onClick={() => { resetar(); onOpenChange(false) }}>Fechar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
