'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Users,
  MapPin, Ruler, Boxes, Settings, Menu, X, LogOut, Store,
} from 'lucide-react'

const SIMBOLO =
  'https://embgxkrfwtbqfkwmquvo.supabase.co/storage/v1/object/public/assets/capua-simbolo.png'

const ITENS = [
  { href: '/painel', rotulo: 'Visao geral', icone: LayoutDashboard },
  { href: '/painel/produtos', rotulo: 'Produtos', icone: Package },
  { href: '/painel/estoque', rotulo: 'Estoque', icone: Boxes },
  { href: '/painel/categorias', rotulo: 'Categorias', icone: FolderTree },
  { href: '/painel/pedidos', rotulo: 'Pedidos', icone: ShoppingCart },
  { href: '/painel/clientes', rotulo: 'Clientes', icone: Users },
  { href: '/painel/cidades', rotulo: 'Cidades', icone: MapPin },
  { href: '/painel/unidades-venda', rotulo: 'Unidades de venda', icone: Ruler },
  { href: '/painel/configuracoes', rotulo: 'Configuracoes', icone: Settings },
]

export function PainelSidebar({ nomeUsuario }: { nomeUsuario: string }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)

  const conteudo = (
    <>
      <div className="flex items-center gap-3 px-5 h-16 border-b border-[var(--sidebar-border)]">
        <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-white p-1.5">
          <Image src={SIMBOLO} alt="Criatório Capuã" width={30} height={24} className="w-full h-auto" />
        </div>
        <div className="leading-[1.15]">
          <div className="font-display font-bold tracking-[0.14em] text-white text-[11px]">CRIATÓRIO</div>
          <div className="font-display font-bold tracking-[0.14em] text-[var(--sidebar-primary)] text-[11px]">CAPUÃ</div>
        </div>
      </div>

      <div className="px-3 pt-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--sidebar-foreground)]/80 hover:bg-[var(--sidebar-accent)]/50 hover:text-white transition-colors"
        >
          <Store className="h-4 w-4" />
          Ver loja
        </Link>
      </div>

      <nav className="flex-1 px-3 pb-4 pt-2 space-y-1 overflow-y-auto">
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
        <form action="/sair" method="POST">
          <button type="submit" className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/50 hover:text-white transition-colors">
            <LogOut className="h-[18px] w-[18px]" />
            Sair
          </button>
        </form>
      </div>
    </>
  )

  return (
    <>
      <div className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-white sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Image src={SIMBOLO} alt="Criatório Capuã" width={28} height={23} />
          <span className="font-display font-bold tracking-wide text-xs text-[var(--brand-navy)]">
            CRIATÓRIO <span className="text-[var(--brand-red)]">CAPUÃ</span>
          </span>
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
