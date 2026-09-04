'use client'

import Link from 'next/link'
import { ChevronDownIcon, LogOutIcon, PackageIcon, UserIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CustomerProfile } from '@/lib/auth'

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0]?.slice(0, 2) ?? ''
  return letras.toUpperCase()
}

// Fase 2, incremento 6 (Área do Cliente) - resolve a lacuna registrada em
// REGRAS_DE_NEGOCIO.md §18.2: o header nunca soube ler o estado de sessão
// do cliente, sempre mostrava "Entrar" mesmo já logado.
//
// Logout: `fetch` no POST /sair só pra aplicar o Set-Cookie que limpa a
// sessão (a rota devolve um 303 que o fetch não navega); a navegação em
// si é `window.location.assign('/')` - vai pra VITRINE (destino único de
// logout pra staff e cliente, REGRAS_DE_NEGOCIO.md §8/§1.1). `assign` é
// navegação de documento de propósito: ignora o Router Cache do cliente,
// o middleware re-avalia a sessão (agora limpa) e a home renderiza o
// estado deslogado - mesmo princípio da correção do item 50.
export function HeaderContaMenu({ cliente }: { cliente: CustomerProfile }) {
  async function sair() {
    await fetch('/sair', { method: 'POST' })
    window.location.assign('/')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        <Avatar size="sm">
          <AvatarFallback>{iniciais(cliente.nome)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-28 truncate sm:inline">{cliente.nome.split(' ')[0]}</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href="/meus-pedidos" />}>
          <PackageIcon className="size-4" />
          Meus Pedidos
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/minha-conta" />}>
          <UserIcon className="size-4" />
          Minha Conta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={sair}>
          <LogOutIcon className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
