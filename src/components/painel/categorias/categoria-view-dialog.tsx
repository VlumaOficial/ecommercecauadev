'use client'

import { PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import { getPath, type CategoriaNode } from '@/lib/category-tree'

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium text-muted-foreground">{rotulo}</div>
      <div className="text-sm text-foreground">{valor}</div>
    </div>
  )
}

export function CategoriaViewDialog({
  open,
  onOpenChange,
  categoria,
  todasCategorias,
  onEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoria: CategoriaNode | null
  todasCategorias: Pick<CategoriaNode, 'id' | 'nome' | 'parent_id'>[]
  onEdit: () => void
}) {
  if (!categoria) return null

  const caminhoPai = categoria.parent_id
    ? getPath(categoria.parent_id, todasCategorias)
    : 'Categoria raiz (sem categoria-pai)'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{categoria.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <StatusBadge ativo={categoria.ativo} />
            {categoria.inativado_em_cascata && (
              <span className="text-xs text-muted-foreground">(inativada por cascata)</span>
            )}
          </div>

          <Campo rotulo="Categoria-pai" valor={caminhoPai} />
          <Campo rotulo="Slug" valor={categoria.slug} />
          <Campo rotulo="Prefixo do código" valor={categoria.prefixo_codigo ?? '—'} />
          <Campo
            rotulo="Descrição"
            valor={categoria.descricao?.trim() ? categoria.descricao : 'Sem descrição'}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={onEdit}>
            <PencilIcon />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
