// Robustez de login (ESCOPO_PROJETO.md §0 item 50) — limpeza MANUAL de
// cookie de sessao, usada pela camada preventiva (src/proxy.ts) e pela
// rota de rede de seguranca (POST /api/auth/limpar-sessao).
//
// NAO usa supabase.auth.signOut() de proposito: lido o codigo-fonte real
// de @supabase/auth-js (_signOut, GoTrueClient.js) - quando a sessao
// esta PRESENTE mas INVALIDA (refresh token corrompido/expirado sem
// poder renovar, exatamente o caso que estamos corrigindo), _useSession
// devolve um erro que NAO e' AuthSessionMissingError, e _signOut
// retorna cedo (`return this._returnResult({ error: sessionError })`)
// SEM chamar removeCurrentSession() - o cookie nunca e' limpo por esse
// caminho. Mesmo ponto cego de getUser() (ver comentario em
// src/proxy.ts). Por isso a limpeza aqui e' 100% manual (Set-Cookie
// Max-Age=0), independente do que o SDK decide fazer.

const PREFIXO_COOKIE_SESSAO = 'sb-'
const SUFIXO_COOKIE_SESSAO = '-auth-token'

// Identifica cookie de sessao Supabase, incluindo as variantes
// fragmentadas que o @supabase/ssr usa quando a sessao passa do limite
// de ~4KB de um cookie so (sb-<ref>-auth-token.0, .1, ...).
export function ehCookieDeSessao(nome: string): boolean {
  return nome.startsWith(PREFIXO_COOKIE_SESSAO) && nome.includes(SUFIXO_COOKIE_SESSAO)
}

// Expira manualmente (Max-Age=0) todo cookie de sessao presente na lista
// de cookies de entrada, escrevendo na resposta. So' age em cookies que
// realmente existem - chamar isto sem nenhum cookie de sessao presente
// e' no-op seguro (nao ha risco de afetar quem nunca teve sessao).
// Devolve os nomes limpos, so' pra log/depuracao de quem chama.
export function limparCookiesDeSessao(
  cookiesEntrada: { name: string }[],
  response: { cookies: { delete: (name: string) => unknown } }
): string[] {
  const limpos: string[] = []
  for (const cookie of cookiesEntrada) {
    if (ehCookieDeSessao(cookie.name)) {
      response.cookies.delete(cookie.name)
      limpos.push(cookie.name)
    }
  }
  return limpos
}
