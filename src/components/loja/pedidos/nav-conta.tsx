'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/meus-pedidos', label: 'Meus Pedidos' },
  { href: '/minha-conta', label: 'Dados da conta' },
]

// Sub-nav leve entre as 2 telas da área do cliente (Fase 2, incremento 6) -
// evita ter que voltar pro dropdown do header toda vez pra alternar entre
// "Meus Pedidos" e "Minha Conta".
export function NavConta() {
  const pathname = usePathname()
  return (
    <nav className="mb-6 flex gap-2 border-b border-border">
      {LINKS.map((link) => {
        const ativo = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
              ativo ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
