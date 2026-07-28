import { redirect } from 'next/navigation'
import { getStaffProfile } from '@/lib/auth'
import { PainelSidebar } from '@/components/painel-sidebar'

export const dynamic = 'force-dynamic'

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const perfil = await getStaffProfile()

  // Nao e equipe (admin/operador) -> fora do painel
  if (!perfil) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] lg:flex">
      <PainelSidebar nomeUsuario={perfil.nome} />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
