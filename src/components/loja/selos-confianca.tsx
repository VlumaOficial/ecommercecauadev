import { TruckIcon, ShieldCheckIcon, HeadsetIcon, LeafIcon, type LucideIcon } from 'lucide-react'

// Valores padrao no codigo - Etapa 3 traz isso pra store_settings
// (texto/icone/ocultar por selo), editavel pelo lojista.
const SELOS: { icone: LucideIcon; texto: string }[] = [
  { icone: TruckIcon, texto: 'Retirada combinada por cidade' },
  { icone: ShieldCheckIcon, texto: 'Animais saudáveis e selecionados' },
  { icone: HeadsetIcon, texto: 'Atendimento especializado' },
  { icone: LeafIcon, texto: 'Cuidado com a origem e o transporte' },
]

export function SelosConfianca() {
  return (
    <section className="border-b border-border bg-muted/40">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:px-6 lg:grid-cols-4">
        {SELOS.map(({ icone: Icon, texto }) => (
          <div key={texto} className="flex items-center gap-2.5">
            <Icon className="size-5 shrink-0 text-primary" />
            <span className="text-sm text-foreground">{texto}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
