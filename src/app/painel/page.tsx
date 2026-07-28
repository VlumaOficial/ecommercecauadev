import { getStaffProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Package, FolderTree, ShoppingCart, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PainelHome() {
  const perfil = await getStaffProfile()
  const supabase = await createClient()

  const [produtos, categorias, clientes] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('categories').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
  ])

  const cards = [
    { rotulo: 'Produtos', valor: produtos.count ?? 0, icone: Package },
    { rotulo: 'Categorias', valor: categorias.count ?? 0, icone: FolderTree },
    { rotulo: 'Clientes', valor: clientes.count ?? 0, icone: Users },
    { rotulo: 'Pedidos', valor: 0, icone: ShoppingCart },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Ola, {perfil?.nome}</h1>
      <p className="text-muted-foreground mt-1 mb-8">Visao geral da loja.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icone = c.icone
          return (
            <div key={c.rotulo} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.rotulo}</span>
                <Icone className="h-5 w-5 text-[var(--brand-aqua)]" />
              </div>
              <p className="mt-2 text-3xl font-bold text-[var(--brand-navy)]">{c.valor}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
