'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { UploadIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { urlArquivoLoja } from '@/lib/loja/rpc'
import { useUploadImagemVitrine } from '@/hooks/use-configuracao-vitrine'

export function ImagemUploadField({
  path,
  tipo,
  onChange,
  aspectoQuadrado,
}: {
  path: string | null
  tipo: 'banner' | 'logo'
  onChange: (path: string | null) => void
  aspectoQuadrado?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadImagemVitrine()

  async function handleFile(file: File | undefined) {
    if (!file) return
    const novoPath = await upload.mutateAsync({ file, tipo })
    onChange(novoPath)
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted ${
          aspectoQuadrado ? 'size-16' : 'h-16 w-28'
        }`}
      >
        {path ? (
          <Image
            src={urlArquivoLoja(path)}
            alt=""
            width={112}
            height={64}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="px-1 text-center text-[11px] text-muted-foreground">Sem imagem</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          {upload.isPending ? 'Enviando...' : path ? 'Trocar imagem' : 'Enviar imagem'}
        </Button>
        {path && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <XIcon />
            Remover
          </Button>
        )}
      </div>
    </div>
  )
}
