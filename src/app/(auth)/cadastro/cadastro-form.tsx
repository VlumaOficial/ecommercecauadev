'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, MailCheck, Eye, EyeOff } from 'lucide-react'

// Cidade de entrega NAO entra mais aqui (decisao de produto,
// 24/08/2026, REGRAS_DE_NEGOCIO.md §14) - "ponto de encontro por
// cidade" e' um detalhe da modalidade de entrega do Cauã, nao algo
// universal de cadastro (uma loja com Correios/retirada fixa nao
// teria isso), e a escolha de onde receber pertence ao momento da
// COMPRA (checkout), nao ao momento de criar a conta. `delivery_city_id`
// nasce nulo no cadastro; o cliente escolhe no checkout (passo de
// Entrega) ou depois em /minha-conta - handle_new_user (migration 033)
// ja trata a ausencia do campo como null de proposito (nullif + try/catch),
// coluna e' nullable desde a 005, nenhuma migration nova precisou disso.
export function CadastroForm({ proximo }: { proximo?: string }) {
  const supabase = createClient()

  // Propaga o destino pos-login (ex.: checkout) atraves do link REAL de
  // confirmacao de e-mail - o callback (src/app/auth/callback/route.ts) ja
  // sabe ler ?next= do redirect_to. Sem isso, confirmar o cadastro sempre
  // levava pra vitrine, mesmo quando o cliente veio de um fluxo com destino
  // proprio (Fase 2, incremento 5 - Checkout).
  function montarEmailRedirectTo() {
    return `${window.location.origin}/auth/callback${proximo ? `?next=${encodeURIComponent(proximo)}` : ''}`
  }

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [reenvioContador, setReenvioContador] = useState(0)
  const [reenviando, setReenviando] = useState(false)

  // Nav pra /entrar sempre por window.location (documento), nunca
  // router.push/<Link> — ignora o Router Cache do cliente (item 50).
  const irParaEntrar = () =>
    window.location.assign(proximo ? `/entrar?proximo=${encodeURIComponent(proximo)}` : '/entrar')

  function formatarWhatsapp(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    const wpp = whatsapp.replace(/\D/g, '')
    if (wpp.length < 10) { toast.error('Informe um WhatsApp valido com DDD.'); return }
    if (senha.length < 8) { toast.error('A senha deve ter ao menos 8 caracteres.'); return }

    setCarregando(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        emailRedirectTo: montarEmailRedirectTo(),
        data: {
          nome: nome.trim(),
          whatsapp: wpp,
        },
      },
    })
    setCarregando(false)

    if (error) {
      // Nunca revela se o motivo foi "e-mail ja cadastrado" - REGRAS_DE_NEGOCIO.md §14.1
      toast.error('Nao foi possivel concluir o cadastro. Tente novamente.')
      return
    }

    // Supabase devolve sucesso silencioso (identities vazio) quando o e-mail ja
    // existia, sem erro - por isso a tela abaixo e sempre a mesma, nos dois casos.
    setEnviado(true)
    setReenvioContador(60)
  }

  useEffect(() => {
    if (reenvioContador <= 0) return
    const t = setTimeout(() => setReenvioContador((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [reenvioContador])

  async function reenviar() {
    setReenviando(true)
    // Nao trata erro/sucesso do resend de forma diferente (REGRAS_DE_NEGOCIO.md §14.1)
    // - um e-mail ja confirmado faz o resend falhar do lado do Supabase, e isso não
    // pode virar um toast diferente do caso normal, ou vira um segundo jeito de
    // descobrir se o e-mail ja tem conta.
    await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: montarEmailRedirectTo() },
    })
    setReenviando(false)
    toast.success('E-mail reenviado.')
    setReenvioContador(60)
  }

  if (enviado) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-display text-xl font-bold text-primary mb-2">Verifique seu e-mail</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Se este e-mail ainda não estiver cadastrado, você receberá um link de confirmação em instantes. Se você já tem uma conta com este e-mail, use a opção de entrar ou recuperar sua senha.
        </p>
        <p className="text-sm font-medium text-foreground mb-4">{email}</p>
        <p className="text-xs text-muted-foreground mb-6">Pode levar alguns minutos. Verifique tambem a caixa de spam.</p>
        <Button onClick={reenviar} disabled={reenvioContador > 0 || reenviando} variant="outline" className="w-full mb-3">
          {reenviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {reenvioContador > 0 ? `Reenviar em ${reenvioContador}s` : 'Reenviar e-mail'}
        </Button>
        <Button onClick={irParaEntrar} variant="ghost" className="w-full">Voltar para entrar</Button>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-primary mb-1">Criar conta</h2>
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
        <a href={proximo ? `/entrar?proximo=${encodeURIComponent(proximo)}` : '/entrar'} className="text-primary font-semibold hover:underline">Entrar</a>
      </p>
    </div>
  )
}
