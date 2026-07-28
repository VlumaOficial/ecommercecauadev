import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VlumaFooter } from '@/components/vluma-footer'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

const SIMBOLO =
  'https://embgxkrfwtbqfkwmquvo.supabase.co/storage/v1/object/public/assets/capua-simbolo.png'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: settings } = await supabase
    .from('store_settings')
    .select('loja_aberta, mensagem_loja_fechada')
    .limit(1)
    .single()

  const lojaAberta = settings?.loja_aberta ?? false

  return (
    <main className="relative min-h-screen flex flex-col bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-[var(--brand-aqua-light)] to-white" />

      <header className="relative z-10 flex items-center justify-between px-5 py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Image src={SIMBOLO} alt="Criatório Capuã" width={40} height={33} priority />
          <span className="font-display font-bold tracking-widest text-[var(--brand-navy)] text-sm">CRIATÓRIO CAPUÃ</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <form action="/sair" method="POST">
              <Button type="submit" variant="ghost" size="sm">Sair</Button>
            </form>
          ) : (
            <>
              <Link href="/entrar"><Button variant="ghost" size="sm">Entrar</Button></Link>
              <Link href="/cadastro"><Button size="sm">Cadastrar</Button></Link>
            </>
          )}
        </div>
      </header>

      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 py-16 max-w-2xl mx-auto">
        <Image src={SIMBOLO} alt="Criatório Capuã" width={120} height={98} priority className="mb-6" />
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-[0.15em] text-[var(--brand-navy)]">CRIATÓRIO</h1>
        <p className="font-display text-lg font-bold tracking-[0.35em] text-[var(--brand-red)] mb-6">CAPUÃ</p>
        <p className="text-muted-foreground max-w-md mb-8">Peixes ornamentais e animais exóticos. Qualidade que nada sempre à frente.</p>

        {lojaAberta ? (
          <Link href="/loja"><Button size="lg" className="h-12 px-8 text-base">Ver catalogo do ciclo</Button></Link>
        ) : (
          <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-sm max-w-md">
            <p className="font-semibold text-[var(--brand-navy)] mb-1">Loja fechada no momento</p>
            <p className="text-sm text-muted-foreground">{settings?.mensagem_loja_fechada ?? 'Aguarde a abertura do próximo ciclo de pedidos.'}</p>
          </div>
        )}
      </section>

      <footer className="relative z-10 flex justify-center py-8">
        <VlumaFooter />
      </footer>
    </main>
  )
}
