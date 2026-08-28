import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { limparCookiesDeSessao } from '@/lib/supabase/limpar-sessao'

// Robustez de login (ESCOPO_PROJETO.md §0 item 50) - rede de segurança
// chamada pelo client de /entrar quando o envio do login não conclui
// dentro do prazo (residuo de sessão que a camada preventiva do
// proxy.ts, por algum motivo de timing, não pegou a tempo). Sem
// sessão/autorização exigida de propósito - é chamada exatamente pra
// quem NÃO está logado com sucesso, mesma lógica de "não tem nada a
// proteger aqui" de /sair. Não aceita parâmetro nenhum, só limpa
// cookies de sessão presentes na própria requisição - superfície de
// abuso nula (pior caso é um auto-logout inofensivo).
export async function POST() {
  const cookieStore = await cookies()
  const response = NextResponse.json({ ok: true })
  const limpos = limparCookiesDeSessao(cookieStore.getAll(), response)
  if (limpos.length > 0) {
    console.log('[limpar-sessao] cookies de sessão expirados manualmente:', limpos.join(', '))
  }
  // [login-debug] instrumentacao TEMPORARIA (GRUPO A) - remover apos o diagnostico.
  console.log(
    '[login-debug] api/auth/limpar-sessao',
    JSON.stringify({
      cookiesSbNaRequisicao: cookieStore
        .getAll()
        .filter((c) => c.name.startsWith('sb-'))
        .map((c) => c.name),
      limpos,
    })
  )
  return response
}
