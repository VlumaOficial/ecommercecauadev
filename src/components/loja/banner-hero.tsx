import Image from 'next/image'
import Link from 'next/link'
import { FishIcon } from 'lucide-react'

import { corTextoContraste } from '@/lib/loja/cor'
import { urlArquivoLoja } from '@/lib/loja/rpc'
import { Button } from '@/components/ui/button'
import type { StoreSettingsPublico } from '@/lib/loja/types'

// Etapa 3 (migration 030): banner passa a ler de store_settings, com
// default = o que já era hardcoded aqui antes. tipo_fundo 'imagem' sem
// banner_imagem_path configurado cai pra 'cor' (nunca renderiza sem
// fundo nenhum).
export function BannerHero({ settings }: { settings: StoreSettingsPublico }) {
  const usaImagem = settings.banner_tipo_fundo === 'imagem' && !!settings.banner_imagem_path
  const corTexto = usaImagem ? '#ffffff' : corTextoContraste(settings.banner_cor_fundo)

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
      <section
        className="relative flex min-h-[220px] items-center overflow-hidden rounded-2xl sm:min-h-[260px]"
        style={
          usaImagem
            ? undefined
            : {
                background: `linear-gradient(135deg, ${settings.banner_cor_fundo} 0%, ${settings.banner_cor_fundo} 55%, color-mix(in oklab, ${settings.banner_cor_fundo} 40%, white) 100%)`,
              }
        }
      >
        {usaImagem && settings.banner_imagem_path && (
          <>
            <Image
              src={urlArquivoLoja(settings.banner_imagem_path)}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            {/* Overlay escuro automático - garante legibilidade do texto sobre qualquer foto, sem depender do lojista escolher uma imagem "escura o suficiente". */}
            <div aria-hidden className="absolute inset-0 bg-black/45" />
          </>
        )}

        {!usaImagem && (
          <FishIcon
            aria-hidden
            className="pointer-events-none absolute -bottom-4 right-4 size-32 rotate-6 sm:size-44"
            style={{ color: corTexto, opacity: 0.25 }}
          />
        )}

        <div className="relative z-[1] max-w-lg px-6 py-10 sm:px-12 sm:py-14" style={{ color: corTexto }}>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">{settings.banner_titulo}</h1>
          <p className="mt-3 text-sm opacity-95 sm:text-base">{settings.banner_subtitulo}</p>
          <Button
            render={<Link href={settings.banner_botao_href} />}
            nativeButton={false}
            size="lg"
            variant="secondary"
            className="mt-5 bg-white text-[color-mix(in_oklab,var(--primary)_85%,black)] hover:bg-white/90"
          >
            {settings.banner_botao_texto}
          </Button>
        </div>
      </section>
    </div>
  )
}
