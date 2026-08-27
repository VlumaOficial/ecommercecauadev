'use client'

import { MailIcon, PencilIcon, PowerIcon, RotateCcwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/painel/crud/status-badge'
import type { StaffMembro } from '@/hooks/use-equipe'

// Só exibição (mesma ideia de formatarWhatsappExibicao em
// pedido-detalhe-view.tsx). O valor no banco é só dígitos.
function formatarWhatsappExibicao(digitos: string | null) {
  if (!digitos) return '—'
  const d = digitos.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digitos
}

export function EquipeTable({
  membros,
  meuId,
  isLoading,
  onEdit,
  onInativar,
  onReativar,
  onReenviarSenha,
}: {
  membros: StaffMembro[]
  meuId: string | undefined
  isLoading: boolean
  onEdit: (membro: StaffMembro) => void
  onInativar: (membro: StaffMembro) => void
  onReativar: (membro: StaffMembro) => void
  onReenviarSenha: (membro: StaffMembro) => void
}) {
  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (membros.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum membro da equipe encontrado.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>WhatsApp</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Aceita pedidos</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {membros.map((membro) => {
          const souEu = membro.id === meuId
          return (
            <TableRow key={membro.id}>
              <TableCell className="font-medium">
                {membro.nome}
                {souEu && <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>}
              </TableCell>
              <TableCell className="text-muted-foreground">{membro.email}</TableCell>
              <TableCell className="text-muted-foreground">{formatarWhatsappExibicao(membro.whatsapp)}</TableCell>
              <TableCell>
                <Badge variant={membro.role === 'admin' ? 'default' : 'outline'}>
                  {membro.role === 'admin' ? 'Administrador' : 'Operador'}
                </Badge>
              </TableCell>
              <TableCell>
                {membro.role === 'admin' ? (
                  <span className="text-xs text-muted-foreground">Sempre (admin)</span>
                ) : membro.pode_aceitar_pedido ? (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Sim</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Não</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge ativo={membro.ativo} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onReenviarSenha(membro)}
                    aria-label={`Reenviar link de senha para ${membro.nome}`}
                    title="Reenviar link de senha"
                  >
                    <MailIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onEdit(membro)} aria-label={`Editar ${membro.nome}`}>
                    <PencilIcon />
                  </Button>
                  {membro.ativo ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onInativar(membro)}
                      disabled={souEu}
                      aria-label={souEu ? 'Você não pode desativar sua própria conta' : `Desativar ${membro.nome}`}
                      title={souEu ? 'Você não pode desativar sua própria conta' : undefined}
                    >
                      <PowerIcon />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onReativar(membro)}
                      aria-label={`Reativar ${membro.nome}`}
                    >
                      <RotateCcwIcon />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
