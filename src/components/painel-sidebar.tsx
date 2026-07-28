'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Users,
  MapPin, Settings, Menu, X, LogOut,
} from 'lucide-react'

const SIMBOLO =
  'https://embgxkrfwtbqfkwmquvo.supabase.co/storage/v1/object/public/assets/capua-simbolo.png'

const ITENS = [
  { href: '/painel', rotulo: 'Visao geral', icone: LayoutDashboard },
  { href: '/painel/produtos', rotulo: 'Produtos', icone: Package },
  { href: '/painel/categorias', rotulo: 'Categorias', icone: FolderTree },
  { href: '/painel/pedidos', rotulo: 'Pedidos', icone: ShoppingCart },
  { href: '/painel/clientes', rotulo: 'Clientes', icone: Users },
  { href: '/painel/cidades', rotulo: 'Cidades', icone: MapPin },
  { href: '/painel/configuracoes', rotulo: 'Configuracoes', icone: Settings },
]

export function PainelSidebar({ nomeUsuario }: { nomeUsuario: string }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)

  const conteudo = (
    <>
      <div className="flex items-center gap-2 px-5 h-16 border-b border-[var(--sidebar-border)]">
        <Image src={SIMBOLO} alt="Capua" width={32} height={26} />
        <span className="font-display font-bold tracking-wider text-white text-sm">CAPUA</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {ITENS.map((item) => {
          const ativo = pathname === item.href || (item.href !== '/painel' && pathname.startsWith(item.href))
          const Icone = item.icone
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                ativo
                  ? 'bg-[var(--sidebar-accent)] text-white'
                  : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/50 hover:text-white'
              }`}
            >
              <Icone className="h-[18px] w-[18px]" />
              {item.rotulo}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] p-3">
        <div className="px-2 pb-2 text-xs text-[var(--sidebar-foreground)]/70 truncate">{nomeUsuario}</div>
        <Link href="/sair" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/50 hover:text-white transition-colors">
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </Link>
      </div>
    </>
  )

  return (
    <>
      <div className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-white sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Image src={SIMBOLO} alt="Capua" width={28} height={23} />
          <span className="font-display font-bold tracking-wider text-[var(--brand-navy)] text-sm">CAPUA</span>
        </div>
        <button onClick={() => setAberto(true)} aria-label="Abrir menu"><Menu className="h-6 w-6 text-[var(--brand-navy)]" /></button>
      </div>

      {aberto && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setAberto(false)} />
      )}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[var(--sidebar)] flex flex-col transition-transform lg:translate-x-0 ${aberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setAberto(false)} className="lg:hidden absolute right-3 top-4 text-white/70 hover:text-white" aria-label="Fechar menu"><X className="h-5 w-5" /></button>
        {conteudo}
      </aside>
    </>
  )
}
