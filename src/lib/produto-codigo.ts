import { slugify } from '@/lib/category-tree'

// Conectores curtos ignorados na divisao por palavras (nao carregam
// identidade nenhuma pro prefixo - "Racao de Superficie" deve virar
// RASU, nao RADE). Lista fechada, decidida com o usuario em 01/08/2026.
const CONECTORES = new Set(['de', 'da', 'do', 'e', 'em', 'com'])

// Deriva o prefixo do codigo de produto a partir do nome da categoria.
// Reaproveita a normalizacao NFD do slugify() (remove acento mantendo
// a letra base) em vez de duplicar a mesma regex de novo aqui.
//
// Regra por numero de palavras (decidida com o usuario em 01/08/2026,
// pensada pra reduzir colisao entre categoria-mae e subcategoria com
// nome parecido - "Betas" vs "Beta Azul" era o caso real que motivou
// isso: as duas derivavam pra "BET" com a regra antiga de 3 letras
// fixas do nome inteiro):
//   1 palavra  -> 3 primeiras letras                    ("Ciclideos" -> CIC)
//   2 palavras -> 2 primeiras letras de cada palavra     ("Beta azul" -> BEAZ)
//   3+ palavras -> 2 letras da 1a palavra + 1a letra de
//                  cada palavra seguinte, ate 4 letras    ("Racao Filhotes Premium" -> RAFP)
//
// Continua NAO sendo garantia absoluta de unicidade (dois nomes bem
// diferentes ainda podem coincidir por acaso) - por isso o servidor
// mantem o auto-sufixo numerico de 4 digitos como rede de seguranca
// quando mesmo assim colidir (ver inserirComPrefixo/atualizarComPrefixo
// em src/app/api/painel/categorias).
export function derivarPrefixo(nome: string): string {
  const todasPalavras = slugify(nome).split('-').filter(Boolean)
  const semConectores = todasPalavras.filter((p) => !CONECTORES.has(p))
  const palavras = semConectores.length > 0 ? semConectores : todasPalavras

  if (palavras.length === 0) return ''
  if (palavras.length === 1) return palavras[0].toUpperCase().slice(0, 3)
  if (palavras.length === 2) return (palavras[0].slice(0, 2) + palavras[1].slice(0, 2)).toUpperCase()

  let prefixo = palavras[0].slice(0, 2)
  for (let i = 1; i < palavras.length && prefixo.length < 4; i++) {
    prefixo += palavras[i].slice(0, 1)
  }
  return prefixo.toUpperCase()
}

// Formata o codigo final: PREFIXO-NNNN (zeros a esquerda, 4 digitos).
// Usado tanto no peek (preview sem reservar) quanto pra exibir o
// codigo ja gerado.
export function formatarCodigo(prefixo: string, numero: number): string {
  return `${prefixo}-${String(numero).padStart(4, '0')}`
}
