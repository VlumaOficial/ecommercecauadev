'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandHeader } from '@/components/brand-header'
import { VlumaFooter } from '@/components/vluma-footer'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
        toast.error('E-mail ainda nao confirmado. Verifique sua caixa de entrada.')
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('E-mail ou senha incorretos.')
      } else {
        toast.error('Nao foi possivel entrar. Tente novamente.')
      }
      return
    }

    toast.success('Bem-vindo de volta!')
    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[var(--brand-aqua-light)] to-white" />
      <div className="relative w-full max-w-md">
        <div className="mb-8">
          <BrandHeader />
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(11,46,92,0.15)] p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-[var(--brand-navy)] mb-1">Entrar</h2>
          <p className="text-sm text-muted-foreground mb-6">Acesse sua conta para fazer pedidos.</p>

          <form onSubmit={entrar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha">Senha</Label>
                <Link href="/recuperar-senha" className="text-xs text-[var(--brand-navy)] hover:underline">Esqueci minha senha</Link>
              </div>
              <Input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="********" />
            </div>

            <Button type="submit" disabled={carregando} className="w-full h-11 text-base">
              {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Ainda nao tem conta?{' '}
            <Link href="/cadastro" className="text-[var(--brand-navy)] font-semibold hover:underline">Cadastre-se</Link>
          </p>
        </div>

        <div className="flex justify-center mt-8">
          <VlumaFooter />
        </div>
      </div>
    </main>
  )
}
