'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function NovaSenhaPage() {
  const supabase = createClient()
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 8) { toast.error('A senha deve ter ao menos 8 caracteres.'); return }
    if (senha !== confirmar) { toast.error('As senhas nao coincidem.'); return }

    setCarregando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setCarregando(false)
    if (error) {
      toast.error('Nao foi possivel alterar a senha. O link pode ter expirado.')
      return
    }
    toast.success('Senha alterada com sucesso!')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-primary mb-1">Criar nova senha</h2>
      <p className="text-sm text-muted-foreground mb-6">Escolha uma nova senha para sua conta.</p>
      <form onSubmit={salvar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="senha">Nova senha</Label>
          <div className="relative">
            <Input id="senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Minimo 8 caracteres" className="pr-10" />
            <button type="button" onClick={() => setMostrar((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}>
              {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmar">Confirmar senha</Label>
          <Input id="confirmar" type={mostrar ? 'text' : 'password'} autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a senha" />
        </div>
        <Button type="submit" disabled={carregando} className="w-full h-11 text-base">
          {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar nova senha
        </Button>
      </form>
    </div>
  )
}
