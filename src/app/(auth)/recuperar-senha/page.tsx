'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandHeader } from '@/components/brand-header'
import { VlumaFooter } from '@/components/vluma-footer'
import { toast } from 'sonner'
import { Loader2, MailCheck } from 'lucide-react'

export default function RecuperarSenhaPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [contador, setContador] = useState(0)
  const [reenviando, setReenviando] = useState(false)

  async function solicitar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/nova-senha`,
    })
    setCarregando(false)
    if (error) {
      toast.error('Nao foi possivel enviar agora. Tente novamente.')
      return
    }
    setEnviado(true)
    setContador(60)
  }

  useEffect(() => {
    if (contador <= 0) return
    const t = setTimeout(() => setContador((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [contador])

  async function reenviar() {
    setReenviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/nova-senha`,
    })
    setReenviando(false)
    if (error) { toast.error('Nao foi possivel reenviar agora.'); return }
    toast.success('E-mail reenviado.')
    setContador(60)
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[var(--brand-aqua-light)] to-white" />
      <div className="relative w-full max-w-md">
        <div className="mb-8"><BrandHeader /></div>
        {children}
        <div className="flex justify-center mt-8"><VlumaFooter /></div>
      </div>
    </main>
  )

  if (enviado) {
    return (
      <Wrapper>
        <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(11,46,92,0.15)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-aqua-light)]">
            <MailCheck className="h-7 w-7 text-[var(--brand-navy)]" />
          </div>
          <h2 className="font-display text-xl font-bold text-[var(--brand-navy)] mb-2">Verifique seu e-mail</h2>
          <p className="text-sm text-muted-foreground mb-1">Se houver uma conta para</p>
          <p className="text-sm font-medium text-foreground mb-4">{email}</p>
          <p className="text-xs text-muted-foreground mb-6">enviamos um link para redefinir a senha. Verifique tambem o spam.</p>
          <Button onClick={reenviar} disabled={contador > 0 || reenviando} variant="outline" className="w-full mb-3">
            {reenviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {contador > 0 ? `Reenviar em ${contador}s` : 'Reenviar e-mail'}
          </Button>
          <Link href="/entrar"><Button variant="ghost" className="w-full">Voltar para entrar</Button></Link>
        </div>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(11,46,92,0.15)] p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-[var(--brand-navy)] mb-1">Recuperar senha</h2>
        <p className="text-sm text-muted-foreground mb-6">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
        <form onSubmit={solicitar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
          <Button type="submit" disabled={carregando} className="w-full h-11 text-base">
            {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar link
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground mt-6">
          <Link href="/entrar" className="text-[var(--brand-navy)] font-semibold hover:underline">Voltar para entrar</Link>
        </p>
      </div>
    </Wrapper>
  )
}
