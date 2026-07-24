'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const SIMBOLO =
  'https://embgxkrfwtbqfkwmquvo.supabase.co/storage/v1/object/public/assets/capua-simbolo.png'

export default function EntrarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    setCarregando(false)

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        toast.error('E-mail ainda não confirmado. Verifique sua caixa de entrada.')
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('E-mail ou senha incorretos.')
      } else {
        toast.error('Não foi possível entrar. Tente novamente.')
      }
      return
    }

    toast.success('Bem-vindo de volta!')
    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[var(--brand-aqua-light)] to-white px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image src={SIMBOLO} alt="Criatório Capuã" width={92} height={75} priority />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-widest text-[var(--brand-navy)]">
            CRIATÓRIO
          </h1>
          <p className="text-sm font-bold tracking-[0.3em] text-[var(--brand-red)]">
            CAPUÃ
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-foreground mb-1">Entrar</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Acesse sua conta para fazer pedidos.
          </p>

          <form onSubmit={entrar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha">Senha</Label>
                <Link
                  href="/recuperar-senha"
                  className="text-xs text-[var(--brand-navy)] hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" disabled={carregando} className="w-full">
              {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Ainda não tem conta?{' '}
            <Link href="/cadastro" className="text-[var(--brand-navy)] font-medium hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Desenvolvido por{' '}
          <a href="https://www.vluma.com.br" className="font-semibold text-[var(--brand-navy)] hover:underline">
            VLUMA
          </a>
        </p>
      </div>
    </main>
  )
}
