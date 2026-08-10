export type CategoriaNode = {
  id: string
  nome: string
  slug: string
  descricao: string | null
  parent_id: string | null
  ordem: number
  ativo: boolean
  inativado_em_cascata: boolean
  // Prefixo do codigo de produto (migration 016, decisao #18). Nulo
  // ate a categoria ser salva com o prefixo derivado/digitado.
  prefixo_codigo: string | null
}

export type CategoriaTreeNode = CategoriaNode & { filhos: CategoriaTreeNode[] }

export function buildTree(flat: CategoriaNode[]): CategoriaTreeNode[] {
  const porId = new Map<string, CategoriaTreeNode>(
    flat.map((c) => [c.id, { ...c, filhos: [] }])
  )
  const raizes: CategoriaTreeNode[] = []

  for (const node of porId.values()) {
    if (node.parent_id && porId.has(node.parent_id)) {
      porId.get(node.parent_id)!.filhos.push(node)
    } else {
      raizes.push(node)
    }
  }

  const ordenar = (nodes: CategoriaTreeNode[]) => {
    nodes.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
    nodes.forEach((n) => ordenar(n.filhos))
  }
  ordenar(raizes)

  return raizes
}

// Todos os IDs descendentes de `id` (sem incluir o proprio id) — usado
// pra excluir a subarvore da propria categoria do seletor de pai
// (validacao anti-ciclo).
export function getDescendantIds(
  id: string,
  flat: Pick<CategoriaNode, 'id' | 'parent_id'>[]
): Set<string> {
  const filhosPorPai = new Map<string, string[]>()
  for (const c of flat) {
    if (!c.parent_id) continue
    const lista = filhosPorPai.get(c.parent_id) ?? []
    lista.push(c.id)
    filhosPorPai.set(c.parent_id, lista)
  }

  const resultado = new Set<string>()
  const pilha = [...(filhosPorPai.get(id) ?? [])]
  while (pilha.length > 0) {
    const atual = pilha.pop()!
    if (resultado.has(atual)) continue
    resultado.add(atual)
    pilha.push(...(filhosPorPai.get(atual) ?? []))
  }
  return resultado
}

// Caminho da raiz ate `id` (nomes), usado pra rotular o combobox de
// categoria-pai com contexto de hierarquia (ex.: "Racao > Caes").
export function getPath(id: string, flat: Pick<CategoriaNode, 'id' | 'nome' | 'parent_id'>[]): string {
  const porId = new Map(flat.map((c) => [c.id, c]))
  const partes: string[] = []
  let atual = porId.get(id)
  while (atual) {
    partes.unshift(atual.nome)
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined
  }
  return partes.join(' > ')
}

// Mesmo caminho de getPath, mas como lista de segmentos {id, nome} em
// vez de string ja concatenada - usado pelo filtro de categoria em
// /painel/produtos (categoria-filter-popover.tsx) pro breadcrumb
// clicavel (cada segmento precisa do proprio id pra navegar de volta).
export function getPathSegments(
  id: string,
  flat: Pick<CategoriaNode, 'id' | 'nome' | 'parent_id'>[]
): { id: string; nome: string }[] {
  const porId = new Map(flat.map((c) => [c.id, c]))
  const segmentos: { id: string; nome: string }[] = []
  let atual = porId.get(id)
  while (atual) {
    segmentos.unshift({ id: atual.id, nome: atual.nome })
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined
  }
  return segmentos
}

// Nó visivel se ele mesmo bate no filtro OU e ancestral de algum nó
// que bate (mantem o caminho ate a raiz pra dar contexto na arvore).
export function computeVisibleIds(
  flat: CategoriaNode[],
  filtro: { status: 'ativos' | 'inativos' | 'todos'; busca: string }
): Set<string> {
  const busca = filtro.busca.trim().toLowerCase()

  const bateFiltro = (c: CategoriaNode) => {
    if (filtro.status === 'ativos' && !c.ativo) return false
    if (filtro.status === 'inativos' && c.ativo) return false
    if (busca && !c.nome.toLowerCase().includes(busca)) return false
    return true
  }

  const porId = new Map(flat.map((c) => [c.id, c]))
  const visiveis = new Set<string>()

  for (const c of flat) {
    if (!bateFiltro(c)) continue
    visiveis.add(c.id)
    let atual = c
    while (atual.parent_id && porId.has(atual.parent_id)) {
      atual = porId.get(atual.parent_id)!
      visiveis.add(atual.id)
    }
  }

  return visiveis
}

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
