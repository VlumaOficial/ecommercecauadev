'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

import { Checkbox } from '@/components/ui/checkbox'

export function FiltroDisponibilidade() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const disponivel = searchParams.get('disponivel') === '1'
  const promocao = searchParams.get('promocao') === '1'

  function atualizarParam(chave: string, valor: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor === null) params.delete(chave)
    else params.set(chave, valor)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="border-t border-border pt-3.5">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Disponibilidade</h3>
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <Checkbox checked={disponivel} onCheckedChange={(v) => atualizarParam('disponivel', v ? '1' : null)} />
          Disponível
        </label>
        <label className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <Checkbox checked={promocao} onCheckedChange={(v) => atualizarParam('promocao', v ? '1' : null)} />
          Em promoção
        </label>
      </div>
    </div>
  )
}
