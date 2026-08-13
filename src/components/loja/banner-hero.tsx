import Link from 'next/link'
import { FishIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Valores padrao no codigo por enquanto - Etapa 3 do plano da Vitrine
// Fase 1 traz isso pra store_settings, editavel pelo lojista.
const BANNER_PADRAO = {
  titulo: 'Peixes ornamentais direto do criatório',
  subtitulo: 'Qualidade, saúde e variedade. Monte seu pedido e retire no ponto de encontro da sua cidade.',
  botaoTexto: 'Ver catálogo →',
  botaoHref: '/produtos',
}

export function BannerHero() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
      <section className="relative flex min-h-[220px] items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-cyan-300 text-primary-foreground sm:min-h-[260px]">
        <FishIcon
          aria-hidden
          className="pointer-events-none absolute -bottom-4 right-4 size-32 rotate-6 text-white/25 sm:size-44"
        />
        <div className="relative z-[1] max-w-lg px-6 py-10 sm:px-12 sm:py-14">
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">{BANNER_PADRAO.titulo}</h1>
          <p className="mt-3 text-sm text-primary-foreground/95 sm:text-base">{BANNER_PADRAO.subtitulo}</p>
          <Button
            render={<Link href={BANNER_PADRAO.botaoHref} />}
            nativeButton={false}
            size="lg"
            variant="secondary"
            className="mt-5 bg-white text-[color-mix(in_oklab,var(--primary)_85%,black)] hover:bg-white/90"
          >
            {BANNER_PADRAO.botaoTexto}
          </Button>
        </div>
      </section>
    </div>
  )
}
