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
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { casarNomeArquivoComSku, mensagemErroCasamento } from '@/lib/importacao/casar-foto-sku'
import { baixarCsv } from '@/lib/importacao/download'
import { cn } from '@/lib/utils'

// Frente A, incremento 3 (fotos por SKU) - aprovado pelo PO em
// 04/09/2026. Upload em massa reaproveita as rotas EXISTENTES de
// imagem (POST/DELETE/reorder) - nenhuma delas foi alterada. O browser
// chama cada rota 1x por arquivo, sequencial DENTRO de cada SKU
// (garante ordem 0,1,2...), com um pool pequeno de concorrência ENTRE
// SKUs diferentes.
const POOL_CONCORRENCIA = 4

type MapaSku = { sku: string; product_id: string; variant_id: string; imagens: { id: string; ordem: number }[] }

type ArquivoCasado = { file: File; ordemEfetiva: number }
type GrupoSku = MapaSku & { arquivos: ArquivoCasado[] }

type ErroPrevio = { arquivo: string; motivo: string }

type ResultadoArquivo =
  | { arquivo: string; sku: string; status: 'sucesso'; ordem: number }
  | { arquivo: string; sku?: string; status: 'erro'; motivo: string }

type Etapa = 'upload' | 'previa' | 'progresso' | 'resultado'
type Modo = 'adicionar' | 'substituir'

export function ImportarFotosDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [carregandoMapa, setCarregandoMapa] = useState(false)
  const [modo, setModo] = useState<Modo>('adicionar')
  const [grupos, setGrupos] = useState<GrupoSku[]>([])
  const [errosPrevios, setErrosPrevios] = useState<ErroPrevio[]>([])
  const [confirmarSubstituir, setConfirmarSubstituir] = useState(false)
  const [progresso, setProgresso] = useState({ enviados: 0, total: 0 })
  const [resultadosFinais, setResultadosFinais] = useState<ResultadoArquivo[]>([])
  const [enviando, setEnviando] = useState(false)

  function resetar() {
    setEtapa('upload')
    setModo('adicionar')
    setGrupos([])
    setErrosPrevios([])
    setConfirmarSubstituir(false)
    setProgresso({ enviados: 0, total: 0 })
    setResultadosFinais([])
    setEnviando(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function processarArquivos(arquivos: File[]) {
    if (arquivos.length === 0) return
    setCarregandoMapa(true)
    try {
      const resposta = await fetch('/api/painel/produtos/fotos/mapa-skus')
      const body = await resposta.json().catch(() => null)
      if (!resposta.ok || !Array.isArray(body?.mapa)) {
        setErrosPrevios([{ arquivo: '(geral)', motivo: 'Não foi possível carregar os SKUs cadastrados. Tente novamente.' }])
        setEtapa('previa')
        return
      }

      const mapa: MapaSku[] = body.mapa
      const skusPorChave = new Map(mapa.map((m) => [m.sku.toUpperCase(), m.sku]))
      const gruposPorSku = new Map<string, GrupoSku>()
      const previos: ErroPrevio[] = []

      for (const file of arquivos) {
        const casamento = casarNomeArquivoComSku(file.name, skusPorChave)
        if (!casamento.ok) {
          previos.push({ arquivo: file.name, motivo: mensagemErroCasamento(casamento.motivo) })
          continue
        }
        const info = mapa.find((m) => m.sku === casamento.sku)!
        const grupo = gruposPorSku.get(casamento.sku) ?? { ...info, arquivos: [] }
        grupo.arquivos.push({ file, ordemEfetiva: casamento.ordemEfetiva })
        gruposPorSku.set(casamento.sku, grupo)
      }

      setGrupos([...gruposPorSku.values()])
      setErrosPrevios(previos)
      setEtapa('previa')
    } finally {
      setCarregandoMapa(false)
    }
  }

  function iniciarClicado() {
    if (modo === 'substituir') {
      setConfirmarSubstituir(true)
    } else {
      iniciarImportacao()
    }
  }

  async function iniciarImportacao() {
    setConfirmarSubstituir(false)
    setEtapa('progresso')
    setEnviando(true)
    const totalArquivos = grupos.reduce((soma, g) => soma + g.arquivos.length, 0)
    setProgresso({ enviados: 0, total: totalArquivos })

    const resultados: ResultadoArquivo[] = [...errosPrevios.map((e) => ({ arquivo: e.arquivo, status: 'erro' as const, motivo: e.motivo }))]
    let concluidos = 0
    const atualizarProgresso = (n: number) => {
      concluidos += n
      setProgresso({ enviados: concluidos, total: totalArquivos })
    }

    const fila = [...grupos]
    async function worker() {
      while (fila.length > 0) {
        const grupo = fila.shift()
        if (!grupo) break
        const resultadosGrupo = await processarGrupo(grupo, modo, atualizarProgresso)
        resultados.push(...resultadosGrupo)
      }
    }
    await Promise.all(Array.from({ length: POOL_CONCORRENCIA }, () => worker()))

    setResultadosFinais(resultados)
    setEnviando(false)
    setEtapa('resultado')
    queryClient.invalidateQueries({ queryKey: ['produto'] })
  }

  function baixarLog() {
    const cabecalho = ['arquivo', 'sku', 'status', 'ordem', 'motivo']
    const linhas = resultadosFinais.map((r) => [
      r.arquivo,
      r.sku ?? '',
      r.status,
      r.status === 'sucesso' ? String(r.ordem) : '',
      r.status === 'erro' ? r.motivo : '',
    ])
    baixarCsv([cabecalho, ...linhas], 'log-importacao-fotos.csv')
  }

  const sucessos = resultadosFinais.filter((r): r is Extract<ResultadoArquivo, { status: 'sucesso' }> => r.status === 'sucesso')
  const erros = resultadosFinais.filter((r): r is Extract<ResultadoArquivo, { status: 'erro' }> => r.status === 'erro')
  const skusAfetados = new Set(sucessos.map((r) => r.sku)).size
  const totalArquivosPrevia = grupos.reduce((soma, g) => soma + g.arquivos.length, 0) + errosPrevios.length

  return (
    <>
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
            <DialogTitle>Importar fotos por SKU</DialogTitle>
            <DialogDescription>
              {etapa === 'upload' && 'Nomeie os arquivos pelo SKU da variação (ex.: SKU.jpg = foto única/capa, SKU-1.jpg, SKU-2.jpg = galeria).'}
              {etapa === 'previa' && 'Confira o casamento antes de enviar.'}
              {etapa === 'progresso' && 'Enviando as fotos...'}
              {etapa === 'resultado' && 'Importação concluída.'}
            </DialogDescription>
          </DialogHeader>

          {etapa === 'upload' && (
            <div className="space-y-3">
              <div
                className="rounded-lg border border-dashed border-border p-8 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  processarArquivos([...e.dataTransfer.files])
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => processarArquivos([...(e.target.files ?? [])])}
                />
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={carregandoMapa}>
                  <UploadIcon />
                  {carregandoMapa ? 'Carregando...' : 'Selecionar fotos (ou arraste aqui)'}
                </Button>
              </div>
            </div>
          )}

          {etapa === 'previa' && (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                <strong>{totalArquivosPrevia}</strong> arquivo(s) selecionado(s) — <strong>{grupos.length}</strong> SKU(s)
                reconhecido(s){errosPrevios.length > 0 && <> , <strong>{errosPrevios.length}</strong> com erro (não serão enviados)</>}.
              </p>

              <div className="flex gap-2">
                {(
                  [
                    { value: 'adicionar' as const, label: 'Adicionar à galeria', desc: 'Fotos novas entram, as existentes ficam.' },
                    { value: 'substituir' as const, label: 'Substituir', desc: 'Troca as fotos atuais dos SKUs deste lote.' },
                  ]
                ).map((opcao) => (
                  <button
                    key={opcao.value}
                    type="button"
                    onClick={() => setModo(opcao.value)}
                    className={cn(
                      'flex-1 rounded-lg border p-3 text-left text-sm transition-colors',
                      modo === opcao.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <div className="font-medium text-foreground">{opcao.label}</div>
                    <div className="text-xs text-muted-foreground">{opcao.desc}</div>
                  </button>
                ))}
              </div>

              {modo === 'substituir' && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  As fotos atuais das {grupos.length} variação(ões) deste lote serão <strong>apagadas permanentemente</strong> antes de
                  subir as novas.
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
                {progresso.enviados}/{progresso.total} fotos processadas...
              </p>
            </div>
          )}

          {etapa === 'resultado' && (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                <strong>{sucessos.length}</strong> foto(s) enviada(s), <strong>{skusAfetados}</strong> SKU(s) afetado(s),{' '}
                <strong>{erros.length}</strong> erro(s).
              </p>

              {erros.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {erros.map((r, i) => (
                        <TableRow key={`${r.arquivo}-${i}`}>
                          <TableCell className="text-muted-foreground">{r.arquivo}</TableCell>
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
                  Trocar arquivos
                </Button>
                <Button type="button" onClick={iniciarClicado} disabled={grupos.length === 0}>
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

      <ConfirmDialog
        open={confirmarSubstituir}
        onOpenChange={setConfirmarSubstituir}
        title="Substituir fotos existentes?"
        description={`As fotos atuais das ${grupos.length} variação(ões) presentes neste lote serão APAGADAS PERMANENTEMENTE do armazenamento antes das novas fotos entrarem — não é possível desfazer. As variações que já não têm foto continuam sem foto até o envio ser concluído com sucesso; se alguma foto nova falhar no meio do caminho, as fotos antigas daquele SKU são preservadas (nada fica sem foto por causa de uma falha parcial).`}
        confirmLabel="Substituir"
        destructive
        onConfirm={iniciarImportacao}
      />
    </>
  )
}

// Processa um SKU inteiro: sobe as fotos novas na ordem certa; no modo
// substituir, só apaga as antigas e reordena as novas SE TODAS as
// novas subiram com sucesso - se alguma falhar, desfaz (remove) as que
// já tinham subido e preserva as fotos antigas intocadas. Nunca deixa
// uma variação sem foto nenhuma por causa de uma falha no meio.
async function processarGrupo(grupo: GrupoSku, modo: Modo, onProgresso: (n: number) => void): Promise<ResultadoArquivo[]> {
  const resultados: ResultadoArquivo[] = []
  const idsUploadados: string[] = []
  let falhou = false

  const arquivosOrdenados = [...grupo.arquivos].sort((a, b) => a.ordemEfetiva - b.ordemEfetiva)

  for (const { file } of arquivosOrdenados) {
    if (falhou) {
      resultados.push({ arquivo: file.name, sku: grupo.sku, status: 'erro', motivo: 'Envio cancelado — outro arquivo deste SKU falhou antes.' })
      onProgresso(1)
      continue
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('variant_id', grupo.variant_id)
    try {
      const resposta = await fetch(`/api/painel/produtos/${grupo.product_id}/imagens`, { method: 'POST', body: formData })
      const body = await resposta.json().catch(() => null)
      if (!resposta.ok || !body?.data?.id) {
        resultados.push({ arquivo: file.name, sku: grupo.sku, status: 'erro', motivo: body?.error ?? 'Não foi possível enviar esta imagem.' })
        falhou = true
      } else {
        idsUploadados.push(body.data.id)
        resultados.push({ arquivo: file.name, sku: grupo.sku, status: 'sucesso', ordem: body.data.ordem })
      }
    } catch {
      resultados.push({ arquivo: file.name, sku: grupo.sku, status: 'erro', motivo: 'Falha de comunicação com o servidor.' })
      falhou = true
    }
    onProgresso(1)
  }

  if (modo === 'substituir') {
    if (falhou) {
      // Rollback: remove as que subiram com sucesso, preserva as
      // fotos antigas intocadas - o SKU nunca fica sem foto nenhuma.
      for (const id of idsUploadados) {
        await fetch(`/api/painel/produtos/${grupo.product_id}/imagens/${id}`, { method: 'DELETE' }).catch(() => {})
      }
      if (idsUploadados.length > 0) {
        resultados.push({ arquivo: '(fotos parcialmente enviadas)', sku: grupo.sku, status: 'erro', motivo: 'Substituição cancelada por falha parcial — as fotos anteriores foram preservadas.' })
      }
    } else {
      // Sucesso total: só agora apaga as antigas e reordena as novas
      // pra 0,1,2... (o upload já as numerou por cima da contagem
      // antiga, que ainda existia nesse momento).
      for (const antiga of grupo.imagens) {
        await fetch(`/api/painel/produtos/${grupo.product_id}/imagens/${antiga.id}`, { method: 'DELETE' }).catch(() => {})
      }
      if (idsUploadados.length > 0) {
        await fetch(`/api/painel/produtos/${grupo.product_id}/imagens/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsUploadados }),
        }).catch(() => {})
      }
    }
  }

  return resultados
}
