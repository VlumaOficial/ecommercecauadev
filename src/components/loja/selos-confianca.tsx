import { FishIcon } from 'lucide-react'

import { ICONES_SELO } from '@/lib/loja/icones-selo'
import type { SeloConfianca } from '@/lib/loja/types'

export function SelosConfianca({ selos }: { selos: SeloConfianca[] }) {
  const ativos = selos.filter((s) => s.ativo)
  if (ativos.length === 0) return null

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ativos.map((selo) => {
          const Icon = ICONES_SELO[selo.icone] ?? FishIcon
          return (
            <div key={selo.titulo} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <Icon className="size-6 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">{selo.titulo}</p>
                <p className="text-xs text-muted-foreground">{selo.subtitulo}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
