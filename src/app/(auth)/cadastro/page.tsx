'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useDeliveryCities } from '@/hooks/use-delivery-cities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BrandHeader } from '@/components/brand-header'
import { VlumaFooter } from '@/components/vluma-footer'
import { toast } from 'sonner'
import { Loader2, MailCheck, Eye, EyeOff } from 'lucide-react'

export default function CadastroPage() {
  const supabase = createClient()
  const { data: cidades, isLoading: carregandoCidades } = useDeliveryCities()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cidadeId, setCidadeId] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  function formatarWhatsapp(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    if (!cidadeId) { toast.error('Selecione sua cidade de entrega.'); return }
    const wpp = whatsapp.replace(/\D/g, '')
    if (wpp.length < 10) { toast.error('Informe um WhatsApp valido com DDD.'); return }
    if (senha.length < 8) { toast.error('A senha deve ter ao menos 8 caracteres.'); return }

    setCarregando(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          nome: nome.trim(),
          whatsapp: wpp,
          delivery_city_id: cidadeId,
          role: 'cliente',
        },
      },
    })
    setCarregando(false)

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Este e-mail ja possui cadastro. Tente entrar.')
      } else {
        toast.error('Nao foi possivel concluir o cadastro. Tente novamente.')
      }
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[var(--brand-aqua-light)] to-white" />
        <div className="relative w-full max-w-md text-center">
          <div className="mb-8"><BrandHeader /></div>
          <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(11,46,92,0.15)] p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-aqua-light)]">
              <MailCheck className="h-7 w-7 text-[var(--brand-navy)]" />
            </div>
            <h2 className="font-display text-xl font-bold text-[var(--brand-navy)] mb-2">Confirme seu e-mail</h2>
            <p className="text-sm text-muted-foreground mb-1">Enviamos um link de confirmacao para</p>
            <p className="text-sm font-medium text-foreground mb-4">{email}</p>
            <p className="text-xs text-muted-foreground">Pode levar alguns minutos. Verifique tambem a caixa de spam.</p>
          </div>
          <div className="flex justify-center mt-8"><VlumaFooter /></div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[var(--brand-aqua-light)] to-white" />
      <div className="relative w-full max-w-md">
        <div className="mb-8"><BrandHeader /></div>

        <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(11,46,92,0.15)] p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-[var(--brand-navy)] mb-1">Criar conta</h2>
          <p className="text-sm text-muted-foreground mb-6">Cadastre-se para fazer seus pedidos.</p>

          <form onSubmit={cadastrar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" inputMode="tel" required value={whatsapp} onChange={(e) => setWhatsapp(formatarWhatsapp(e.target.value))} placeholder="(71) 99999-9999" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade de entrega</Label>
              <Select value={cidadeId} onValueChange={(v) => setCidadeId(v ?? '')}>
                <SelectTrigger id="cidade" className="w-full">
                  <SelectValue placeholder={carregandoCidades ? 'Carregando...' : 'Selecione sua cidade'}>
                    {(value: string | null) => {
                      const c = cidades?.find((x) => x.id === value)
                      return c ? `${c.nome}${c.uf ? ' - ' + c.uf : ''}` : ''
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cidades?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}{c.uf ? ` - ${c.uf}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Entregamos apenas nas cidades listadas.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input id="senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Minimo 8 caracteres" className="pr-10" />
                <button type="button" onClick={() => setMostrarSenha((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={carregando} className="w-full h-11 text-base">
              {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Ja tem conta?{' '}
            <Link href="/entrar" className="text-[var(--brand-navy)] font-semibold hover:underline">Entrar</Link>
          </p>
        </div>

        <div className="flex justify-center mt-8"><VlumaFooter /></div>
      </div>
    </main>
  )
}
