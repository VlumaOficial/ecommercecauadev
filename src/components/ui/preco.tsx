import { cn } from '@/lib/utils'

// Separa "R$" do valor via Intl.formatToParts() (mais confiavel que
// fatiar a string de formatarMoeda() na mao). O simbolo fica menor,
// mais leve e discreto - o numero e' o protagonista, do jeito que
// preco (dado transacional que o cliente precisa ler rapido e
// confiar) deve se comportar, diferente de um titulo estilizado.
function partesPreco(valor: number) {
  const partes = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).formatToParts(valor)
  const simbolo = partes.find((p) => p.type === 'currency')?.value ?? 'R$'
  const numero = partes
    .filter((p) => p.type !== 'currency' && p.type !== 'literal')
    .map((p) => p.value)
    .join('')
  return { simbolo, numero }
}

// Preco "hero" (ficha de produto, total do checkout) - de proposito
// NUNCA usa font-display (a fonte decorativa da marca, Syne): preco e'
// dado que o cliente confere/soma, nao um titulo de vitrine. `className`
// controla tamanho/peso do NUMERO; o simbolo sempre reduz proporcionalmente
// (em `em`) e fica em peso/cor secundarios, qualquer que seja o tamanho.
export function Preco({ valor, className }: { valor: number; className?: string }) {
  const { simbolo, numero } = partesPreco(valor)
  return (
    <span className={cn('tabular-nums', className)}>
      <span className="mr-1 text-[0.55em] font-medium text-muted-foreground align-[0.1em]">{simbolo}</span>
      {numero}
    </span>
  )
}
