import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Troca de senha genérica (staff OU cliente - qualquer sessão autenticada,
// por isso mora em /api/auth, não em /api/loja) via client SERVIDOR
// (cookies() do Next). supabase.auth.updateUser() chamado direto do
// browser client (createBrowserClient) NUNCA enxerga uma sessão
// estabelecida por uma rota servidor (cookies httpOnly, ilegíveis por
// document.cookie) - bug real encontrado testando /nova-senha com
// Chromium contra a URL pública (Fase 2, incremento 6): recuperação de
// senha estava quebrada em produção porque a sessão criada por
// /auth/callback (após clicar no link do e-mail) nunca chegava ao
// browser client. Mesma causa raiz e mesma correção já aplicada em
// /api/loja/checkout (incremento 5).
const senhaSchema = z.object({
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sua sessão expirou. Faça login novamente.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = senhaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.senha })
  if (error) {
    return NextResponse.json({ error: 'Não foi possível alterar a senha. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
