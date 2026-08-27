import { cn, formatarMoeda } from '@/lib/utils'

// Componente ÚNICO de exibição de valor monetário no produto — toda
// tela que mostra dinheiro (preço, total, subtotal) passa por aqui, pra
// a tipografia de valor ser definida num lugar só. NUNCA usa font-display
// (a fonte decorativa da marca, Syne): preço é dado que o cliente
// confere/soma, não um título de vitrine. Um check de CI
// (scripts/check-money-typography.mjs) trava a regressão: `formatarMoeda`
// só pode ser chamado aqui dentro (em .tsx) e `font-display` não pode
// aparecer perto de valor.

// Separa "R$" do valor via Intl.formatToParts() (mais confiavel que
// fatiar a string de formatarMoeda() na mao). No modo padrão o simbolo
// fica menor/mais leve/discreto — o numero e' o protagonista.
function partesPreco(valor: number) {
  const partes = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).formatToParts(valor)
  const simbolo = partes.find((p) => p.type === 'currency')?.value ?? 'R$'
  const numero = partes
    .filter((p) => p.type !== 'currency' && p.type !== 'literal')
    .map((p) => p.value)
    .join('')
  return { simbolo, numero }
}

export function Preco({
  valor,
  className,
  inline = false,
}: {
  valor: number | null
  className?: string
  // `inline`: uso no meio de uma frase ("Faltam R$ 12,00 para o mínimo").
  // O valor sai por extenso, com o "R$" no tamanho normal — nada de
  // simbolo reduzido no corpo de um texto. Fora de frase (preço/total
  // isolado), deixe no padrão (`inline` false).
  inline?: boolean
}) {
  if (valor === null) return <span className={cn('tabular-nums', className)}>—</span>

  if (inline) {
    return <span className={cn('tabular-nums whitespace-nowrap', className)}>{formatarMoeda(valor)}</span>
  }

  const { simbolo, numero } = partesPreco(valor)
  return (
    <span className={cn('tabular-nums', className)}>
      <span className="mr-1 text-[0.55em] font-medium text-muted-foreground align-[0.1em]">{simbolo}</span>
      {numero}
    </span>
  )
}
