'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronRightIcon, FolderTreeIcon, HistoryIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getPath, getPathSegments, type CategoriaNode } from '@/lib/category-tree'

// Por navegador/dispositivo (localStorage), nao sincroniza entre a
// equipe nem entre computadores do mesmo funcionario - decisao
// deliberada pra comecar simples, sem migration. Documentado em
// docs/ESCOPO_PROJETO.md como limitacao conhecida.
const RECENTES_KEY = 'vluma:produtos:categorias-recentes'
const RECENTES_MAX = 5
// Teto de resultados renderizados na busca - a lista e' sempre
// achatada (sem arvore expandida), entao sem isso uma busca generica
// com centenas de categorias no catalogo poderia devolver uma lista
// tao grande quanto o proprio combobox que este componente substitui.
const BUSCA_CAP = 30

function lerRecentes(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const bruto = window.localStorage.getItem(RECENTES_KEY)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function salvarRecente(id: string) {
  if (typeof window === 'undefined') return
  try {
    const atuais = lerRecentes().filter((x) => x !== id)
    window.localStorage.setItem(RECENTES_KEY, JSON.stringify([id, ...atuais].slice(0, RECENTES_MAX)))
  } catch {
    // localStorage indisponivel (modo privado, quota) - recentes so
    // nao persistem entre sessoes, nao impede selecionar a categoria.
  }
}

// Ancestrais em cinza + ultimo segmento (a propria categoria) na cor
// normal - a mesma linha que aparece na busca e nos recentes, pra
// identificar a categoria mesmo com nomes repetidos entre ramos.
function CaminhoCompleto({ segmentos }: { segmentos: string[] }) {
  if (segmentos.length <= 1) return <>{segmentos[0]}</>
  return (
    <>
      <span className="text-muted-foreground">{segmentos.slice(0, -1).join(' › ')} › </span>
      {segmentos[segmentos.length - 1]}
    </>
  )
}

function LinhaCaminho({
  categoria,
  categorias,
  contagem,
  onSelect,
}: {
  categoria: CategoriaNode
  categorias: CategoriaNode[]
  contagem: Record<string, number>
  onSelect: (id: string) => void
}) {
  const segmentos = getPathSegments(categoria.id, categorias).map((s) => s.nome)
  return (
    <div
      role="option"
      aria-selected={false}
      tabIndex={0}
      onClick={() => onSelect(categoria.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(categoria.id)
      }}
      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
    >
      <span className="min-w-0 flex-1 truncate">
        <CaminhoCompleto segmentos={segmentos} />
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{contagem[categoria.id] ?? 0}</span>
    </div>
  )
}

// Linha do modo "navegar": categoria com filhos so' entra no nivel
// seguinte (drill) - nunca seleciona direto, pra isso existe a linha
// fixa "Selecionar <nivel atual>" assim que entra nela (ver corpo do
// componente). Categoria folha (sem filhos) seleciona no clique,
// nao tem pra onde mais navegar.
function LinhaNavegar({
  categoria,
  contagem,
  temFilhos,
  onDrill,
  onSelect,
}: {
  categoria: CategoriaNode
  contagem: Record<string, number>
  temFilhos: boolean
  onDrill: () => void
  onSelect: () => void
}) {
  return (
    <div
      role="option"
      aria-selected={false}
      tabIndex={0}
      onClick={() => (temFilhos ? onDrill() : onSelect())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (temFilhos ? onDrill() : onSelect())
      }}
      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
    >
      <span className="min-w-0 flex-1 truncate">{categoria.nome}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
        {contagem[categoria.id] ?? 0}
        {temFilhos && <ChevronRightIcon className="size-3.5" />}
      </span>
    </div>
  )
}

// Filtro de categoria pra listagem de produtos, pensado pra escalar a
// CENTENAS de categorias: o lojista nunca ve a arvore inteira de uma
// vez. Busca (caminho inteiro, nao so' o nome proprio - resolve
// ambiguidade entre ramos com nomes parecidos) e' o caminho principal;
// navegacao por nivel (raizes -> clica -> filhos diretos, com
// breadcrumb pra voltar) e recentes (localStorage, ver nota acima)
// cobrem quem prefere nao digitar.
export function CategoriaFilterPopover({
  categorias,
  contagem,
  value,
  onChange,
}: {
  categorias: CategoriaNode[]
  contagem: Record<string, number>
  value: string
  onChange: (categoryId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>([])

  useEffect(() => {
    if (open) setRecentIds(lerRecentes())
  }, [open])

  const categoriasAtivas = useMemo(() => categorias.filter((c) => c.ativo), [categorias])
  const porId = useMemo(() => new Map(categoriasAtivas.map((c) => [c.id, c])), [categoriasAtivas])

  function temFilhos(id: string) {
    return categoriasAtivas.some((c) => c.parent_id === id)
  }
  function filhosDe(parentId: string | null) {
    return categoriasAtivas
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
  }

  const buscaAtiva = busca.trim().length > 0

  const resultadosBusca = useMemo(() => {
    if (!buscaAtiva) return []
    const termo = busca.trim().toLowerCase()
    // Casa no CAMINHO INTEIRO (nome + ancestrais), nao so' no nome
    // proprio - decisao explicita: buscar so' pelo nome falha quando o
    // lojista lembra pelo ramo, ou quando ha nomes repetidos entre
    // ramos diferentes (ambiguidade que o caminho completo resolve).
    return categoriasAtivas
      .filter((c) => getPath(c.id, categoriasAtivas).toLowerCase().includes(termo))
      .sort((a, b) => getPath(a.id, categoriasAtivas).localeCompare(getPath(b.id, categoriasAtivas)))
  }, [categoriasAtivas, busca, buscaAtiva])

  const resultadosLimitados = resultadosBusca.slice(0, BUSCA_CAP)

  const recentesValidos = recentIds
    .map((id) => porId.get(id))
    .filter((c): c is CategoriaNode => !!c)

  const categoriaAtualNivel = currentParentId ? porId.get(currentParentId) : null
  const breadcrumb = currentParentId ? getPathSegments(currentParentId, categoriasAtivas) : []
  const listaAtual = filhosDe(currentParentId)

  const categoriaSelecionada = value ? porId.get(value) : undefined

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setBusca('')
      setCurrentParentId(null)
    }
  }

  function handleSelect(id: string) {
    onChange(id)
    salvarRecente(id)
    // Fecha via handleOpenChange (nao setOpen direto) - precisa do
    // mesmo reset de busca/currentParentId de qualquer outro
    // fechamento, senao reabrir o popover depois de selecionar uma
    // categoria dentro de um nivel de navegacao volta pro MESMO nivel
    // em vez de raiz+recentes.
    handleOpenChange(false)
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            categoriaSelecionada ? (
              <button
                type="button"
                title={getPath(categoriaSelecionada.id, categoriasAtivas)}
                className="flex h-8 items-center rounded-full bg-secondary pl-3 pr-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              />
            ) : (
              <Button variant="outline" className="font-normal" />
            )
          }
          nativeButton={false}
        >
          {categoriaSelecionada ? (
            categoriaSelecionada.nome
          ) : (
            <>
              <FolderTreeIcon className="size-4 text-muted-foreground" />
              Categoria
            </>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <div className="border-b border-border p-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por qualquer parte do caminho..."
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {buscaAtiva ? (
              <>
                {resultadosLimitados.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
                )}
                {resultadosLimitados.map((c) => (
                  <LinhaCaminho
                    key={c.id}
                    categoria={c}
                    categorias={categoriasAtivas}
                    contagem={contagem}
                    onSelect={handleSelect}
                  />
                ))}
                {resultadosBusca.length > BUSCA_CAP && (
                  <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                    Mostrando {BUSCA_CAP} de {resultadosBusca.length} — refine a busca.
                  </p>
                )}
              </>
            ) : (
              <>
                {currentParentId === null && recentesValidos.length > 0 && (
                  <>
                    <p className="flex items-center gap-1 px-2 pt-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <HistoryIcon className="size-3" />
                      Recentes
                    </p>
                    {recentesValidos.map((c) => (
                      <LinhaCaminho
                        key={c.id}
                        categoria={c}
                        categorias={categoriasAtivas}
                        contagem={contagem}
                        onSelect={handleSelect}
                      />
                    ))}
                    <div className="my-1 border-t border-border" />
                  </>
                )}

                {currentParentId !== null && (
                  <>
                    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground">
                      <button type="button" onClick={() => setCurrentParentId(null)} className="hover:text-foreground hover:underline">
                        Categorias
                      </button>
                      {breadcrumb.map((seg, i) => (
                        <span key={seg.id} className="flex items-center gap-1">
                          <span>›</span>
                          {i === breadcrumb.length - 1 ? (
                            <span className="font-medium text-foreground">{seg.nome}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCurrentParentId(seg.id)}
                              className="hover:text-foreground hover:underline"
                            >
                              {seg.nome}
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {categoriaAtualNivel && (
                      <div
                        role="option"
                        aria-selected={false}
                        tabIndex={0}
                        onClick={() => handleSelect(categoriaAtualNivel.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSelect(categoriaAtualNivel.id)
                        }}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-muted"
                      >
                        Selecionar &quot;{categoriaAtualNivel.nome}&quot;
                      </div>
                    )}
                  </>
                )}

                {listaAtual.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    {currentParentId === null ? 'Nenhuma categoria ativa.' : 'Sem subcategorias.'}
                  </p>
                ) : (
                  listaAtual.map((c) => (
                    <LinhaNavegar
                      key={c.id}
                      categoria={c}
                      contagem={contagem}
                      temFilhos={temFilhos(c.id)}
                      onDrill={() => setCurrentParentId(c.id)}
                      onSelect={() => handleSelect(c.id)}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {categoriaSelecionada && (
        <button
          type="button"
          aria-label="Remover filtro de categoria"
          onClick={() => onChange('')}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}
