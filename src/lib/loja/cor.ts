// Utilitarios de cor pra Vitrine (Etapa 3, identidade/banner
// editaveis) - decide contraste de texto (claro/escuro) a partir de
// uma cor configurada pelo lojista, sem depender de biblioteca
// externa. Formula de luminancia simplificada (nao e' o calculo de
// contraste completo do WCAG) - suficiente pra escolher entre branco
// e escuro, nao pra garantir uma razao de contraste exata.

function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace('#', '')
  const r = parseInt(limpo.slice(0, 2), 16)
  const g = parseInt(limpo.slice(2, 4), 16)
  const b = parseInt(limpo.slice(4, 6), 16)
  return [r, g, b]
}

export function corEhClara(hex: string): boolean {
  const [r, g, b] = hexParaRgb(hex)
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminancia > 0.6
}

export function corTextoContraste(hex: string): string {
  return corEhClara(hex) ? '#0f172a' : '#ffffff'
}
