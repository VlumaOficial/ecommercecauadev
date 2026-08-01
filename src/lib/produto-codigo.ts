import { slugify } from '@/lib/category-tree'

// Deriva o prefixo do codigo de produto a partir do nome da categoria
// (ex.: "Ciclideos" -> "CIC"). Reaproveita a normalizacao NFD do
// slugify() (remove acento mantendo a letra base) em vez de duplicar
// a mesma regex de novo aqui - so muda o que sobra no final: 3 letras
// maiusculas, sem separador.
export function derivarPrefixo(nome: string): string {
  return slugify(nome).replace(/-/g, '').toUpperCase().slice(0, 3)
}

// Formata o codigo final: PREFIXO-NNNN (zeros a esquerda, 4 digitos).
// Usado tanto no peek (preview sem reservar) quanto pra exibir o
// codigo ja gerado.
export function formatarCodigo(prefixo: string, numero: number): string {
  return `${prefixo}-${String(numero).padStart(4, '0')}`
}
