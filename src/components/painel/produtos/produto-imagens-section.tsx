'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon, StarIcon, Trash2Icon, ImagePlusIcon, Loader2Icon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import { getProductImageUrl } from '@/lib/storage'
import { validarArquivoImagem, comprimirImagemParaWebp } from '@/lib/image-optimize'
import {
  useUploadImagem,
  useReordenarImagens,
  useDefinirImagemPrincipal,
  useRemoverImagem,
  useAtualizarAltTextImagem,
} from '@/hooks/use-produto-imagens'
import type { ImagemProduto } from '@/hooks/use-produtos'

function ItemImagem({
  imagem,
  podeSerCapa,
  onDefinirPrincipal,
  onPedirRemocao,
  onAltTextChange,
}: {
  imagem: ImagemProduto
  podeSerCapa: boolean
  onDefinirPrincipal: (id: string) => void
  onPedirRemocao: (imagem: ImagemProduto) => void
  onAltTextChange: (id: string, texto: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: imagem.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const url = getProductImageUrl(imagem.storage_path)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="relative aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={imagem.alt_text ?? ''} className="h-full w-full object-cover" />

        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute left-1 top-1 flex size-6 touch-none items-center justify-center rounded bg-black/50 text-white active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
        >
          <GripVerticalIcon className="size-3.5" />
        </button>

        {podeSerCapa && (
          <button
            type="button"
            onClick={() => onDefinirPrincipal(imagem.id)}
            className={`absolute right-1 top-1 flex size-6 items-center justify-center rounded ${
              imagem.principal ? 'bg-amber-400 text-amber-950' : 'bg-black/50 text-white'
            }`}
            aria-label={imagem.principal ? 'Imagem principal' : 'Definir como principal'}
            title={imagem.principal ? 'Imagem principal' : 'Definir como principal'}
          >
            <StarIcon className="size-3.5" fill={imagem.principal ? 'currentColor' : 'none'} />
          </button>
        )}

        <button
          type="button"
          onClick={() => onPedirRemocao(imagem)}
          className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Remover imagem"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>

      <input
        type="text"
        placeholder="Descrição (opcional)"
        defaultValue={imagem.alt_text ?? ''}
        onBlur={(e) => {
          if (e.target.value !== (imagem.alt_text ?? '')) onAltTextChange(imagem.id, e.target.value)
        }}
        className="w-full border-0 border-t border-border bg-transparent px-2 py-1 text-xs outline-none focus:bg-muted/50"
      />
    </div>
  )
}

export function ProdutoImagensSection({
  produtoId,
  variantId,
  imagens,
  maxImagens,
  titulo,
  descricao,
}: {
  produtoId: string
  variantId?: string
  imagens: ImagemProduto[]
  maxImagens: number
  titulo: string
  descricao?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [imagemParaRemover, setImagemParaRemover] = useState<ImagemProduto | null>(null)

  // Estado local pra reordenar otimisticamente durante o drag - mesmo
  // padrao ja usado em CaracteristicasList.
  const [itens, setItens] = useState(imagens)
  useEffect(() => setItens(imagens), [imagens])

  const upload = useUploadImagem(produtoId)
  const reordenar = useReordenarImagens(produtoId)
  const definirPrincipal = useDefinirImagemPrincipal(produtoId)
  const remover = useRemoverImagem(produtoId)
  const atualizarAltText = useAtualizarAltTextImagem(produtoId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const restante = maxImagens - itens.length
    if (restante <= 0) {
      toast.error(`Limite de ${maxImagens} imagens atingido.`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const selecionados = Array.from(files).slice(0, restante)
    if (files.length > selecionados.length) {
      toast.error(`Só dá pra adicionar mais ${restante} imagem(ns) — o limite é ${maxImagens}.`)
    }

    setEnviando(true)
    // Sequencial (nao Promise.all): evita que uploads em paralelo
    // leiam a mesma contagem "antiga" no servidor e furem o limite
    // por uma corrida entre eles.
    for (const file of selecionados) {
      const erro = validarArquivoImagem(file)
      if (erro) {
        toast.error(erro)
        continue
      }
      try {
        const comprimida = await comprimirImagemParaWebp(file)
        await upload.mutateAsync({ arquivo: comprimida, variantId })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Não foi possível processar a imagem.')
      }
    }
    setEnviando(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = itens.findIndex((i) => i.id === active.id)
    const newIndex = itens.findIndex((i) => i.id === over.id)
    const proxima = arrayMove(itens, oldIndex, newIndex)
    setItens(proxima)
    reordenar.mutate(proxima.map((i) => i.id))
  }

  const limiteAtingido = itens.length >= maxImagens

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {itens.length}/{maxImagens} imagens
          </p>
          <label
            className={`inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted ${
              enviando || limiteAtingido ? 'pointer-events-none opacity-50' : 'cursor-pointer'
            }`}
          >
            {enviando ? <Loader2Icon className="size-4 animate-spin" /> : <ImagePlusIcon className="size-4" />}
            {enviando ? 'Enviando...' : 'Adicionar imagem'}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              disabled={enviando || limiteAtingido}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>

        {itens.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma imagem ainda.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itens.map((i) => i.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {itens.map((imagem) => (
                  <ItemImagem
                    key={imagem.id}
                    imagem={imagem}
                    podeSerCapa={!variantId}
                    onDefinirPrincipal={(id) => definirPrincipal.mutate(id)}
                    onPedirRemocao={setImagemParaRemover}
                    onAltTextChange={(id, texto) => atualizarAltText.mutate({ imageId: id, altText: texto })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!imagemParaRemover}
        onOpenChange={(open) => !open && setImagemParaRemover(null)}
        title="Remover imagem?"
        description="A imagem será apagada permanentemente — essa ação não pode ser desfeita."
        confirmLabel="Remover"
        destructive
        loading={remover.isPending}
        onConfirm={() => {
          if (imagemParaRemover) {
            remover.mutate(imagemParaRemover.id, { onSuccess: () => setImagemParaRemover(null) })
          }
        }}
      />
    </Card>
  )
}
