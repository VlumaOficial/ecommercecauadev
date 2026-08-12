import { FishIcon, LeafIcon, PackageIcon, SproutIcon, type LucideIcon } from 'lucide-react'

// Heuristica simples por palavra-chave no nome da categoria - a
// arvore nao tem campo de icone/imagem no modelo hoje (so' nome/slug/
// prefixo). Generico o bastante pra qualquer loja do segmento
// (peixes ornamentais), nao especifico do catalogo do Cauã.
function resolveIcon(nome: string): LucideIcon {
  const n = nome.toLowerCase()
  if (n.includes('planta')) return SproutIcon
  if (n.includes('ração') || n.includes('racao')) return PackageIcon
  if (n.includes('folha') || n.includes('musgo')) return LeafIcon
  return FishIcon
}

export function CategoriaIcon({ nome, className }: { nome: string; className?: string }) {
  const Icon = resolveIcon(nome)
  return <Icon className={className} />
}
