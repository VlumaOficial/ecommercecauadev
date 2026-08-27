#!/usr/bin/env node
// Guarda de tipografia de valores monetarios (decisao do PO).
//
// Regra do produto: TODO valor em dinheiro na UI passa pelo componente
// <Preco> (src/components/ui/preco.tsx), que define a tipografia num
// lugar so' e NUNCA usa a fonte decorativa (font-display / Syne).
// `formatarMoeda()` e' so' a funcao de string, usada por dentro do
// <Preco> e por codigo nao-UI (templates de notificacao, .ts).
//
// Este check falha (exit 1) se:
//   A) `formatarMoeda(` for chamado num arquivo .tsx que nao seja o
//      proprio preco.tsx  -> dinheiro na UI fora do <Preco>
//   B) `font-display` aparecer a <= 3 linhas de `formatarMoeda(` ou de
//      `<Preco`  -> fonte decorativa perto de valor
//
// Escape pontual: comentar `// money-typography-ok` na mesma linha.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname
const SRC = join(RAIZ, 'src')
const PRECO = join('src', 'components', 'ui', 'preco.tsx')
const JANELA = 3

/** @type {string[]} */
const arquivos = []
function varrer(dir) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    const st = statSync(caminho)
    if (st.isDirectory()) varrer(caminho)
    else if (/\.(ts|tsx)$/.test(nome)) arquivos.push(caminho)
  }
}
varrer(SRC)

/** @type {{arquivo:string, linha:number, msg:string}[]} */
const violacoes = []

for (const abs of arquivos) {
  const rel = relative(RAIZ, abs)
  const linhas = readFileSync(abs, 'utf8').split('\n')

  linhas.forEach((linha, i) => {
    if (linha.includes('money-typography-ok')) return
    const n = i + 1

    // Regra A
    if (rel !== PRECO && linha.includes('formatarMoeda(') && rel.endsWith('.tsx')) {
      violacoes.push({
        arquivo: rel,
        linha: n,
        msg: 'formatarMoeda() na UI — use o componente <Preco> em vez de formatar direto.',
      })
    }

    // Regra B
    if (linha.includes('font-display')) {
      for (let j = Math.max(0, i - JANELA); j <= Math.min(linhas.length - 1, i + JANELA); j++) {
        const perto = linhas[j]
        if (perto.includes('money-typography-ok')) continue
        if (perto.includes('formatarMoeda(') || perto.includes('<Preco')) {
          violacoes.push({
            arquivo: rel,
            linha: n,
            msg: `font-display a ${Math.abs(j - i)} linha(s) de um valor (linha ${j + 1}) — valor monetario nunca usa a fonte decorativa.`,
          })
          break
        }
      }
    }
  })
}

if (violacoes.length === 0) {
  console.log('✓ tipografia de valores: OK (nenhum valor fora do <Preco>, nenhum font-display perto de dinheiro)')
  process.exit(0)
}

console.error(`✗ tipografia de valores: ${violacoes.length} violação(ões)\n`)
for (const v of violacoes) console.error(`  ${v.arquivo}:${v.linha}  ${v.msg}`)
console.error('\nCorrija usando <Preco valor={...} /> (src/components/ui/preco.tsx).')
console.error('Exceção legítima e pontual (ex.: aria-label): comente `// money-typography-ok` na linha.')
process.exit(1)
