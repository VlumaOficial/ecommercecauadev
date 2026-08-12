'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Ordenacao } from '@/lib/loja/filtros'

const OPCOES_ORDENACAO: { value: Ordenacao; label: string }[] = [
  { value: 'relevancia', label: 'Relevância' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'novidade', label: 'Novidades primeiro' },
  { value: 'nome-az', label: 'Nome (A-Z)' },
]

export function FiltrosToolbar({ totalResultados }: { totalResultados: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const disponivel = searchParams.get('disponivel') === '1'
  const promocao = searchParams.get('promocao') === '1'
  const ordenar = (searchParams.get('ordenar') as Ordenacao | null) ?? 'relevancia'

  function atualizarParam(chave: string, valor: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor === null) params.delete(chave)
    else params.set(chave, valor)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={disponivel} onCheckedChange={(v) => atualizarParam('disponivel', v ? '1' : null)} />
          Somente disponíveis
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={promocao} onCheckedChange={(v) => atualizarParam('promocao', v ? '1' : null)} />
          Somente em promoção
        </label>
        <span className="text-sm text-muted-foreground">{totalResultados} produto{totalResultados === 1 ? '' : 's'}</span>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="ordenacao" className="text-sm text-muted-foreground">
          Ordenar por
        </Label>
        <Select value={ordenar} onValueChange={(v) => atualizarParam('ordenar', v === 'relevancia' ? null : (v as string))}>
          <SelectTrigger id="ordenacao" size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCOES_ORDENACAO.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
