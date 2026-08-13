import { TruckIcon, ShieldCheckIcon, HeadsetIcon, FishIcon, type LucideIcon } from 'lucide-react'

// Valores padrao no codigo - Etapa 3 traz isso pra store_settings
// (texto/icone/ocultar por selo), editavel pelo lojista.
const SELOS: { icone: LucideIcon; titulo: string; subtitulo: string }[] = [
  { icone: TruckIcon, titulo: 'Retirada combinada', subtitulo: 'Ponto de encontro por cidade' },
  { icone: ShieldCheckIcon, titulo: 'Chegada viva', subtitulo: 'Garantia no transporte' },
  { icone: HeadsetIcon, titulo: 'Atendimento próximo', subtitulo: 'Fale direto pelo WhatsApp' },
  { icone: FishIcon, titulo: 'Criação própria', subtitulo: 'Direto do criatório' },
]

export function SelosConfianca() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SELOS.map(({ icone: Icon, titulo, subtitulo }) => (
          <div key={titulo} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Icon className="size-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">{titulo}</p>
              <p className="text-xs text-muted-foreground">{subtitulo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
