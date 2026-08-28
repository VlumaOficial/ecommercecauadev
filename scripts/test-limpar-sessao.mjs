#!/usr/bin/env node
// Unit test das duas funcoes de decisao de limpeza de sessao
// (src/lib/supabase/limpar-sessao.ts) — a correcao do GRUPO A do item 50.
// Node puro (import nativo de .ts do Node 24), sem framework.
//   node scripts/test-limpar-sessao.mjs

import { ausenciaDefinitivaDeSessao, ehCookieDeSessao } from '../src/lib/supabase/limpar-sessao.ts'

let pass = 0
let fail = 0
function t(nome, real, esperado) {
  if (real === esperado) {
    pass++
    console.log(`  ✅ ${nome}`)
  } else {
    fail++
    console.log(`  ❌ ${nome}  (esperado ${esperado}, veio ${real})`)
  }
}

// ── ausenciaDefinitivaDeSessao: quando E' seguro limpar o cookie ──────
console.log('\nausenciaDefinitivaDeSessao()')

// definitivo -> true (limpa)
t('AuthSessionMissingError -> true', ausenciaDefinitivaDeSessao({ name: 'AuthSessionMissingError', status: 400 }), true)
t('AuthApiError 400 (refresh rejeitado) -> true', ausenciaDefinitivaDeSessao({ name: 'AuthApiError', status: 400 }), true)
t('AuthApiError 401 (token rejeitado) -> true', ausenciaDefinitivaDeSessao({ name: 'AuthApiError', status: 401 }), true)
t('AuthApiError 403 -> true', ausenciaDefinitivaDeSessao({ name: 'AuthApiError', status: 403 }), true)

// transitorio / desconhecido -> false (NAO limpa — fail-safe a favor da sessao)
t('AuthRetryableFetchError status 0 (rede) -> false', ausenciaDefinitivaDeSessao({ name: 'AuthRetryableFetchError', status: 0 }), false)
t('AuthRetryableFetchError status 503 -> false', ausenciaDefinitivaDeSessao({ name: 'AuthRetryableFetchError', status: 503 }), false)
t('AuthApiError 429 (rate-limit) -> false', ausenciaDefinitivaDeSessao({ name: 'AuthApiError', status: 429 }), false)
t('AuthApiError 500 (5xx do GoTrue) -> false', ausenciaDefinitivaDeSessao({ name: 'AuthApiError', status: 500 }), false)
t('AuthApiError sem status -> false', ausenciaDefinitivaDeSessao({ name: 'AuthApiError' }), false)
t('erro desconhecido (name aleatorio) -> false', ausenciaDefinitivaDeSessao({ name: 'AlgumErroNovo', status: 400 }), false)
t('Error generico -> false', ausenciaDefinitivaDeSessao(new Error('boom')), false)
t('null -> false', ausenciaDefinitivaDeSessao(null), false)
t('undefined -> false', ausenciaDefinitivaDeSessao(undefined), false)
t('string -> false', ausenciaDefinitivaDeSessao('nope'), false)

// ── ehCookieDeSessao: casa SO' o cookie de sessao real + fragmentos ───
console.log('\nehCookieDeSessao()')

// casa (cookie de sessao real)
t('sb-<ref>-auth-token -> true', ehCookieDeSessao('sb-embgxkrfwtbqfkwmquvo-auth-token'), true)
t('sb-<ref>-auth-token.0 -> true', ehCookieDeSessao('sb-embgxkrfwtbqfkwmquvo-auth-token.0'), true)
t('sb-<ref>-auth-token.1 -> true', ehCookieDeSessao('sb-embgxkrfwtbqfkwmquvo-auth-token.1'), true)
t('sb-<ref>-auth-token.10 -> true', ehCookieDeSessao('sb-embgxkrfwtbqfkwmquvo-auth-token.10'), true)

// NAO casa (o bug do GRUPO A: proxy apagava o code-verifier)
t('sb-<ref>-auth-token-code-verifier -> false', ehCookieDeSessao('sb-embgxkrfwtbqfkwmquvo-auth-token-code-verifier'), false)
t('sb-<ref>-auth-token-qualquer-sufixo -> false', ehCookieDeSessao('sb-embgxkrfwtbqfkwmquvo-auth-token-outra-coisa'), false)
t('sb-<ref>-auth-token.abc (nao numerico) -> false', ehCookieDeSessao('sb-embgxkrfwtbqfkwmquvo-auth-token.abc'), false)
t('outro cookie sb- qualquer -> false', ehCookieDeSessao('sb-provider-token'), false)
t('cookie nao-supabase -> false', ehCookieDeSessao('session_id'), false)

console.log(`\n=========== ${pass} pass / ${fail} fail ===========`)
process.exit(fail === 0 ? 0 : 1)
