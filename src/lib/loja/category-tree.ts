import type { CategoriaPublica } from '@/lib/loja/types'

export type CategoriaTreeNode = CategoriaPublica & { filhos: CategoriaTreeNode[] }

export function buildTree(flat: CategoriaPublica[]): CategoriaTreeNode[] {
  const porId = new Map<string, CategoriaTreeNode>(flat.map((c) => [c.id, { ...c, filhos: [] }]))
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

// Categoria atual + toda a subarvore - a RPC get_public_products so
// filtra por match exato de category_id (decisao deliberada, ver
// migration 028); quem decide incluir subcategorias na "Listagem por
// categoria" e' a Vitrine, aqui.
export function getSelfAndDescendantIds(id: string, flat: CategoriaPublica[]): Set<string> {
  const filhosPorPai = new Map<string, string[]>()
  for (const c of flat) {
    if (!c.parent_id) continue
    const lista = filhosPorPai.get(c.parent_id) ?? []
    lista.push(c.id)
    filhosPorPai.set(c.parent_id, lista)
  }

  const resultado = new Set<string>([id])
  const pilha = [...(filhosPorPai.get(id) ?? [])]
  while (pilha.length > 0) {
    const atual = pilha.pop()!
    if (resultado.has(atual)) continue
    resultado.add(atual)
    pilha.push(...(filhosPorPai.get(atual) ?? []))
  }
  return resultado
}

// Breadcrumb: raiz -> ... -> categoria atual.
export function getPath(id: string, flat: CategoriaPublica[]): CategoriaPublica[] {
  const porId = new Map(flat.map((c) => [c.id, c]))
  const caminho: CategoriaPublica[] = []
  let atual: CategoriaPublica | undefined = porId.get(id)
  while (atual) {
    caminho.unshift(atual)
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined
  }
  return caminho
}
