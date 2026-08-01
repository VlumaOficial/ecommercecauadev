'use client'

import { useParams } from 'next/navigation'
import { useProduto } from '@/hooks/use-produtos'
import { ProdutoForm } from '@/components/painel/produtos/produto-form'

export default function EditarProdutoPage() {
  const { id } = useParams<{ id: string }>()
  const { data: produto, isLoading, error } = useProduto(id)

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (error || !produto) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {error?.message ?? 'Produto não encontrado.'}
      </p>
    )
  }

  return <ProdutoForm key={produto.id} produto={produto} />
}
