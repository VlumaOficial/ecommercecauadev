'use client'

import { ShoppingCartIcon } from 'lucide-react'
import { toast } from 'sonner'

// Carrinho de verdade e' a Fase 2 - por ora so' visual, com um toast
// pra deixar claro que nao e' um botao quebrado.
export function CartButton() {
  return (
    <button
      type="button"
      onClick={() => toast.info('O carrinho chega na próxima fase da Vitrine.')}
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      aria-label="Carrinho"
    >
      <ShoppingCartIcon className="size-5" />
    </button>
  )
}
