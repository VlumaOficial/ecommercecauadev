'use client'

import { useState, useRef, Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

// Robustez de login (ESCOPO_PROJETO.md §0 item 50) - rede de seguranca,
// client. O POST nativo continua sendo o caminho PRINCIPAL (progressive
// enhancement - funciona mesmo sem este JS); isto so' cobre o caso raro
// em que a camada preventiva do proxy.ts nao pegou a tempo (residuo de
// sessao ainda causando trava). Deteccao e' "de graca": se este timeout
// chega a disparar, a pagina NAO navegou ainda - uma navegacao real
// destroi o contexto JS antes do timer rodar, entao nao ha falso
// positivo por "a pagina ja tinha saido". So' tenta recuperar 1x (nao
// insiste em loop se a segunda tentativa tambem nao navegar).
const PRAZO_TRAVAMENTO_MS = 7000

function FormularioLogin() {
  const searchParams = useSearchParams()
  const proximo = searchParams.get('proximo') || '/'
  const erro = searchParams.get('erro')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const jaTentouRecuperar = useRef(false)

  useEffect(() => {
    if (erro) toast.error(erro)
  }, [erro])

  function handleSubmit() {
    // [login-debug] instrumentacao TEMPORARIA (GRUPO A) - estes logs saem
    // no console do NAVEGADOR (componente client), nao nos Function Logs.
    // Filtrar por "[login-debug]". Remover apos o diagnostico.
    console.log('[login-debug] /entrar: POST nativo do formulario disparado')
    if (jaTentouRecuperar.current) return
    setTimeout(async () => {
      jaTentouRecuperar.current = true
      console.log(
        '[login-debug] /entrar: timer de 7s DISPAROU - a pagina nao navegou (login travou); vou limpar sessao e re-submeter'
      )
      toast.info('Isso está demorando mais que o normal - tentando de novo...')
      try {
        await fetch('/api/auth/limpar-sessao', { method: 'POST' })
        console.log('[login-debug] /entrar: POST /api/auth/limpar-sessao concluido')
      } finally {
        console.log('[login-debug] /entrar: re-submetendo o formulario (2a tentativa)')
        formRef.current?.requestSubmit()
      }
    }, PRAZO_TRAVAMENTO_MS)
  }

  return (
    <form ref={formRef} action="/api/auth/login" method="POST" onSubmit={handleSubmit} className="space-y-4">
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
