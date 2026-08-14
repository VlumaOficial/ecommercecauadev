import {
  TruckIcon,
  ShieldCheckIcon,
  HeadsetIcon,
  FishIcon,
  LeafIcon,
  SproutIcon,
  PackageIcon,
  HeartIcon,
  StarIcon,
  type LucideIcon,
} from 'lucide-react'

import type { SeloConfianca } from '@/lib/loja/types'

// Lista pré-definida de ícones que a Etapa 4 (tela de edição) vai
// oferecer num seletor - a chave (`icone` em store_settings.selos,
// migration 030) é o que fica gravado no banco, nunca o componente
// direto. Chave desconhecida (dado futuro/editado manualmente) cai no
// ícone padrão em vez de quebrar a tela.
const ICONES: Record<string, LucideIcon> = {
  truck: TruckIcon,
  'shield-check': ShieldCheckIcon,
  headset: HeadsetIcon,
  fish: FishIcon,
  leaf: LeafIcon,
  sprout: SproutIcon,
  package: PackageIcon,
  heart: HeartIcon,
  star: StarIcon,
}

export function SelosConfianca({ selos }: { selos: SeloConfianca[] }) {
  const ativos = selos.filter((s) => s.ativo)
  if (ativos.length === 0) return null

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ativos.map((selo) => {
          const Icon = ICONES[selo.icone] ?? FishIcon
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
