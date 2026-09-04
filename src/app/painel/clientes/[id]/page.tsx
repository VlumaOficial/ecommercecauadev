'use client'

import { useParams } from 'next/navigation'
import { ClienteDetalheView } from '@/components/painel/clientes/cliente-detalhe-view'

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  return <ClienteDetalheView id={id} />
}
