// Robustez de login (ESCOPO_PROJETO.md §0 item 50) — limpeza MANUAL de
// cookie de sessao, usada pela camada preventiva (src/proxy.ts, escopada
// a /entrar) e pela rota de rede de seguranca (POST /api/auth/limpar-sessao).
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
//
// ── Correcao de 27/08/2026 (regressao do item 50, GRUPO A) ─────────────
//  1. ehCookieDeSessao passou a casar SO' o cookie de sessao real e seus
//     fragmentos .0/.1 — a versao anterior (`startsWith('sb-') &&
//     includes('-auth-token')`) casava tambem
//     `sb-<ref>-auth-token-code-verifier` (PKCE), entao o proxy apagava o
//     verifier nos fluxos de link de e-mail (reset de senha, confirmacao
//     de cadastro) -> "link invalido".
//  2. ausenciaDefinitivaDeSessao() nova: quem chama decide limpar SO'
//     quando a ausencia de sessao e' CONFIRMADA. Falha de transporte da
//     Auth API (rede / rate-limit / 5xx) NAO e' sinal de sessao morta.
//  3. A chamada preventiva saiu do caminho site-wide do proxy e ficou
//     escopada a /entrar — ver src/proxy.ts.

// Casa: sb-<ref>-auth-token  e  sb-<ref>-auth-token.0 / .1 / .2 ...
// NAO casa: sb-<ref>-auth-token-code-verifier (nem nenhum
// sb-<ref>-auth-token-<sufixo>). O `$` ancora o fim — e' o que exclui o
// -code-verifier, que a regra antiga (sem ancora) deixava passar.
const RE_COOKIE_SESSAO = /^sb-.+-auth-token(\.\d+)?$/

export function ehCookieDeSessao(nome: string): boolean {
  return RE_COOKIE_SESSAO.test(nome)
}

// Interpreta o `error` de supabase.auth.getUser() (quando `user` e' null).
//   true  = ausencia de sessao CONFIRMADA -> e' seguro limpar o cookie
//           residual.
//   false = falha de transporte / rate-limit / erro desconhecido -> NAO
//           limpar: a sessao pode estar perfeitamente valida (fail-safe
//           a favor da sessao).
// Nomes das classes conferidos no fonte do @supabase/auth-js
// (dist/module/lib/errors.js):
//   - AuthSessionMissingError : sem access_token, ou session_id do JWT
//     nao existe mais no banco (usuario deslogado/revogado). `.name` fixo.
//   - AuthApiError            : GoTrue respondeu com erro. `.status` 4xx
//     = token/refresh rejeitado (sessao morta). `.status` 429 = rate-limit
//     (retryable, NAO e' sessao morta).
//   - AuthRetryableFetchError : `.name` fixo; TODA falha de rede/timeout e
//     TODO 5xx do GoTrue viram isto (fetch.js). Retryable por definicao.
export function ausenciaDefinitivaDeSessao(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const nome = (err as { name?: unknown }).name
  const status = (err as { status?: unknown }).status

  if (nome === 'AuthSessionMissingError') return true

  if (
    nome === 'AuthApiError' &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    status !== 429
  ) {
    return true
  }

  // AuthRetryableFetchError (rede / 429 / 5xx) e qualquer erro nao
  // reconhecido NAO sao definitivos -> nao limpa.
  return false
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
