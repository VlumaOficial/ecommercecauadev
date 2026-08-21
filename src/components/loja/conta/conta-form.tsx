'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { CustomerProfile } from '@/lib/auth'
import type { CidadeEntregaPublica } from '@/lib/loja/types'

function formatarWhatsapp(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// Fase 2, incremento 6 (Área do Cliente). Duas secoes independentes, cada
// uma com seu proprio submit: dados cadastrais (PATCH /api/loja/conta,
// so nome/whatsapp/delivery_city_id - email nunca entra aqui) e trocar
// senha (POST /api/auth/senha, mesma rota que corrigiu o /nova-senha).
// As duas via Route Handler com o client SERVIDOR - nunca chamada direta
// do browser client (licao do checkout/nova-senha).
export function ContaForm({ cliente, cidades }: { cliente: CustomerProfile; cidades: CidadeEntregaPublica[] }) {
  const router = useRouter()

  const [nome, setNome] = useState(cliente.nome)
  const [whatsapp, setWhatsapp] = useState(formatarWhatsapp(cliente.whatsapp))
  const [cidadeId, setCidadeId] = useState(cliente.delivery_city_id ?? '')
  const [salvandoDados, setSalvandoDados] = useState(false)

  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault()
    const wpp = whatsapp.replace(/\D/g, '')
    if (!nome.trim()) { toast.error('Informe seu nome.'); return }
    if (wpp.length < 10) { toast.error('Informe um WhatsApp válido com DDD.'); return }

    setSalvandoDados(true)
    const resp = await fetch('/api/loja/conta', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nome.trim(), whatsapp: wpp, delivery_city_id: cidadeId || null }),
    })
    const json = await resp.json().catch(() => ({}))
    setSalvandoDados(false)

    if (!resp.ok) {
      toast.error(json.error || 'Não foi possível salvar seus dados. Tente novamente.')
      return
    }
    toast.success('Dados atualizados!')
    router.refresh()
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 8) { toast.error('A senha deve ter ao menos 8 caracteres.'); return }
    if (senha !== confirmarSenha) { toast.error('As senhas não coincidem.'); return }

    setSalvandoSenha(true)
    const resp = await fetch('/api/auth/senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    })
    const json = await resp.json().catch(() => ({}))
    setSalvandoSenha(false)

    if (!resp.ok) {
      toast.error(json.error || 'Não foi possível alterar a senha. Tente novamente.')
      return
    }
    toast.success('Senha alterada!')
    setSenha('')
    setConfirmarSenha('')
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={salvarDados}
        className="bg-card rounded-2xl border border-border p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] sm:p-8"
      >
        <h2 className="font-display text-lg font-bold text-primary mb-1">Dados cadastrais</h2>
        <p className="text-sm text-muted-foreground mb-6">Seu e-mail de login é {cliente.email} e não pode ser alterado aqui.</p>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" inputMode="tel" required value={whatsapp} onChange={(e) => setWhatsapp(formatarWhatsapp(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cidade">Cidade de entrega</Label>
            <Select value={cidadeId} onValueChange={(v) => setCidadeId(v ?? '')}>
              <SelectTrigger id="cidade" className="w-full">
                <SelectValue placeholder="Selecione sua cidade">
                  {(value: string | null) => {
                    const c = cidades.find((x) => x.id === value)
                    return c ? `${c.nome}${c.uf ? ' - ' + c.uf : ''}` : ''
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cidades.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}{c.uf ? ` - ${c.uf}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" disabled={salvandoDados} className="mt-6 h-11 w-full text-base">
          {salvandoDados && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          Salvar dados
        </Button>
      </form>

      <form
        onSubmit={salvarSenha}
        className="bg-card rounded-2xl border border-border p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] sm:p-8"
      >
        <h2 className="font-display text-lg font-bold text-primary mb-1">Alterar senha</h2>
        <p className="text-sm text-muted-foreground mb-6">Escolha uma nova senha para sua conta.</p>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <div className="relative">
              <Input id="senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" className="pr-10" />
              <button type="button" onClick={() => setMostrarSenha((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar senha</Label>
            <Input id="confirmarSenha" type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" required value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="Repita a senha" />
          </div>
        </div>

        <Button type="submit" disabled={salvandoSenha} className="mt-6 h-11 w-full text-base">
          {salvandoSenha && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          Alterar senha
        </Button>
      </form>
    </div>
  )
}
