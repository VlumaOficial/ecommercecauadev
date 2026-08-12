'use client'

import { useState } from 'react'
import Image from 'next/image'
import { PackageIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export function Galeria({ imagens, nomeProduto }: { imagens: { url: string; alt: string | null }[]; nomeProduto: string }) {
  const [ativa, setAtiva] = useState(0)

  if (imagens.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <PackageIcon className="size-16" />
      </div>
    )
  }

  const imagemAtual = imagens[ativa] ?? imagens[0]

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
        <Image
          src={imagemAtual.url}
          alt={imagemAtual.alt ?? nomeProduto}
          fill
          sizes="(max-width: 1024px) 100vw, 40vw"
          className="object-cover"
          priority
        />
      </div>
      {imagens.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {imagens.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setAtiva(i)}
              className={cn(
                'relative size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition-colors',
                i === ativa ? 'border-primary' : 'border-transparent hover:border-border'
              )}
              aria-label={`Ver imagem ${i + 1}`}
            >
              <Image src={img.url} alt={img.alt ?? nomeProduto} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
