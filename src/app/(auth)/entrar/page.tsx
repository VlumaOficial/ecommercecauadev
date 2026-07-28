'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { entrarAction } from './entrar-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandHeader } from '@/components/brand-header'
import { VlumaFooter } from '@/components/vluma-footer'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'

function FormularioLogin() {
  const searchParams = useSearchParams()
  const proximo = searchParams.get('proximo') || '/'
  const erro = searchParams.get('erro')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  useEffect(() => {
    if (erro) toast.error(erro)
  }, [erro])

  return (
    <form action={entrarAction} className="space-y-4">
      <input type="hidden" name="proximo" value={proximo} />
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="voce@email.com" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="senha">Senha</Label>
          <Link href="/recuperar-senha" className="text-xs text-[var(--brand-navy)] hover:underline">Esqueci minha senha</Link>
        </div>
        <div className="relative">
          <Input id="senha" name="senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password" required placeholder="********" className="pr-10" />
          <button type="button" onClick={() => setMostrarSenha((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
            {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" className="w-full h-11 text-base">Entrar</Button>
    </form>
  )
}

export default function EntrarPage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[var(--brand-aqua-light)] to-white" />
      <div className="relative w-full max-w-md">
        <div className="mb-8"><BrandHeader /></div>
        <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(11,46,92,0.15)] p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-[var(--brand-navy)] mb-1">Entrar</h2>
          <p className="text-sm text-muted-foreground mb-6">Acesse sua conta para fazer pedidos.</p>
          <Suspense><FormularioLogin /></Suspense>
          <p className="text-sm text-center text-muted-foreground mt-6">
            Ainda nao tem conta?{' '}
            <Link href="/cadastro" className="text-[var(--brand-navy)] font-semibold hover:underline">Cadastre-se</Link>
          </p>
        </div>
        <div className="flex justify-center mt-8"><VlumaFooter /></div>
      </div>
    </main>
  )
}
