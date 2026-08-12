import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Valores padrao no codigo por enquanto - Etapa 3 do plano da Vitrine
// Fase 1 traz isso pra store_settings, editavel pelo lojista.
const BANNER_PADRAO = {
  titulo: 'Peixes ornamentais direto do Criatório Capuã',
  subtitulo: 'Espécies selecionadas, estoque atualizado e retirada combinada por cidade de entrega.',
  botaoTexto: 'Ver catálogo completo',
  botaoHref: '/produtos',
}

export function BannerHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-cyan-700 text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {BANNER_PADRAO.titulo}
        </h1>
        <p className="max-w-xl text-base text-primary-foreground/90 sm:text-lg">{BANNER_PADRAO.subtitulo}</p>
        <Button render={<Link href={BANNER_PADRAO.botaoHref} />} nativeButton={false} size="lg" variant="secondary">
          {BANNER_PADRAO.botaoTexto}
        </Button>
      </div>
    </section>
  )
}
