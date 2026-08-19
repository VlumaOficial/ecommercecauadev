'use client'

import { useState, Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'
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
    <form action="/api/auth/login" method="POST" className="space-y-4">
      <input type="hidden" name="proximo" value={proximo} />
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="voce@email.com" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="senha">Senha</Label>
          <Link href="/recuperar-senha" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
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
    <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-primary mb-1">Entrar</h2>
      <p className="text-sm text-muted-foreground mb-6">Acesse sua conta para fazer pedidos.</p>
      <Suspense><FormularioLogin /></Suspense>
      <p className="text-sm text-center text-muted-foreground mt-6">
        Ainda nao tem conta?{' '}
        <Link href="/cadastro" className="text-primary font-semibold hover:underline">Cadastre-se</Link>
      </p>
    </div>
  )
}
