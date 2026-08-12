// Dados de teste da Vitrine Fase 1, Etapa 1 (catalogo realista de
// peixes ornamentais para o tenant `capua`, ambiente de HML).
//
// Roda via SERVICE_ROLE_KEY (as RPCs de painel exigem is_staff(), que
// depende de auth.uid() - sem sessao de staff real neste script, entao
// os inserts sao feitos direto nas tabelas, replicando em JS a mesma
// logica que as RPCs/rotas do painel aplicam: derivarPrefixo() e
// abreviar_rotulo() (mesma regra por palavras, src/lib/produto-codigo.ts
// e migration 027), geracao de codigo via product_code_sequences
// (migration 024), SKU automatico (migration 027), estoque inicial via
// stock_movements tipo 'inventario' (migration 022, nunca grava saldo
// direto).
//
// Registra todo ID criado em docs/vitrine_fase1_seed_manifest.json -
// isso e o mecanismo de reversibilidade (nao ha prefixo "TESTE" nos
// nomes de proposito, ver decisao do usuario em 12/08/2026: os dados
// vao aparecer na vitrine publica pra validacao visual da Etapa 2,
// entao precisam de nome realista).
//
// NAO e idempotente - rodar duas vezes duplica categorias/produtos.
// Se precisar rodar de novo, apagar manualmente usando o manifesto
// anterior primeiro (script de rollback nao existe ainda, ver
// docs/ESCOPO_PROJETO.md pra registrar se for necessario criar um).

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ---------- replica de src/lib/category-tree.ts:slugify ----------
function slugify(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ---------- replica de src/lib/produto-codigo.ts:derivarPrefixo ----------
// (mesma regra usada em abreviar_rotulo() no banco, migration 027)
const CONECTORES = new Set(['de', 'da', 'do', 'e', 'em', 'com'])
function derivarPrefixo(nome) {
  const todasPalavras = slugify(nome).split('-').filter(Boolean)
  const semConectores = todasPalavras.filter((p) => !CONECTORES.has(p))
  const palavras = semConectores.length > 0 ? semConectores : todasPalavras
  if (palavras.length === 0) return 'VAR'
  if (palavras.length === 1) return palavras[0].toUpperCase().slice(0, 3)
  if (palavras.length === 2) return (palavras[0].slice(0, 2) + palavras[1].slice(0, 2)).toUpperCase()
  let prefixo = palavras[0].slice(0, 2)
  for (let i = 1; i < palavras.length && prefixo.length < 4; i++) {
    prefixo += palavras[i].slice(0, 1)
  }
  return prefixo.toUpperCase()
}

function formatarCodigo(prefixo, numero) {
  return `${prefixo}-${String(numero).padStart(4, '0')}`
}

// ---------- manifesto (mecanismo de reversibilidade) ----------
const manifest = {
  criado_em: new Date().toISOString(),
  descricao: 'Vitrine Fase 1, Etapa 1 - dados de teste (peixes ornamentais) no tenant capua, ambiente HML',
  tenant_slug: 'capua',
  categorias: [],
  category_attributes: [],
  products: [],
  product_variants: [],
  product_attribute_values: [],
  product_images: [],
  stock_movements: [],
}

async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

// ---------- 0. tenant + referencias existentes ----------
const tenant = await must(supabase.from('tenants').select('id').eq('slug', 'capua').single(), 'tenant capua')
const TENANT_ID = tenant.id

const unidadesRows = await must(
  supabase.from('unidades_venda').select('id, nome').eq('tenant_id', TENANT_ID).eq('ativo', true),
  'unidades_venda'
)
const UNIDADE = Object.fromEntries(unidadesRows.map((u) => [u.nome, u.id]))

const raizes = await must(
  supabase.from('categories').select('id, nome, ordem').eq('tenant_id', TENANT_ID).is('parent_id', null),
  'categorias raiz'
)
const CATEGORIA_RAIZ = Object.fromEntries(raizes.map((c) => [c.nome, c.id]))

console.log('Tenant capua:', TENANT_ID)
console.log('Categorias raiz existentes:', CATEGORIA_RAIZ)

// ---------- 1. subcategorias novas ----------
const NOVAS_SUBCATEGORIAS = [
  { nome: 'Acarás', parentNome: 'Ciclídeo', grupo: 'peixe' },
  { nome: 'Oscars', parentNome: 'Ciclídeo', grupo: 'peixe' },
  { nome: 'Ciclídeos Anões', parentNome: 'Ciclídeo', grupo: 'peixe' },
  { nome: 'Beta Halfmoon', parentNome: 'Betas', grupo: 'peixe' },
  { nome: 'Beta Plakat', parentNome: 'Betas', grupo: 'peixe' },
  { nome: 'Plantas de Fundo', parentNome: 'Plantas', grupo: 'planta' },
  { nome: 'Plantas Flutuantes', parentNome: 'Plantas', grupo: 'planta' },
]

const CATEGORIA_ID = {} // nome -> id (novas subcategorias)
let ordemSub = 0
for (const sub of NOVAS_SUBCATEGORIAS) {
  const parentId = CATEGORIA_RAIZ[sub.parentNome]
  const slug = slugify(sub.nome)
  const prefixo = derivarPrefixo(sub.nome)
  const row = await must(
    supabase
      .from('categories')
      .insert({
        tenant_id: TENANT_ID,
        nome: sub.nome,
        slug,
        parent_id: parentId,
        prefixo_codigo: prefixo,
        ordem: ordemSub++,
        ativo: true,
      })
      .select()
      .single(),
    `categoria ${sub.nome}`
  )
  CATEGORIA_ID[sub.nome] = row.id
  manifest.categorias.push({ id: row.id, nome: sub.nome, parent: sub.parentNome })
  console.log(`categoria criada: ${sub.nome} (${row.id}), prefixo=${prefixo}`)
}

// Ração (raiz existente) recebe produtos direto - sem subcategoria nova
CATEGORIA_ID['Ração'] = CATEGORIA_RAIZ['Ração']

// ---------- 2. caracteristicas por categoria ----------
const ATRIBUTOS_PEIXE = [
  { rotulo: 'Temperamento', tipo: 'selecao', opcoes: ['Pacífico', 'Semi-agressivo', 'Agressivo'], obrigatorio: true, usar_em_filtro: true },
  { rotulo: 'Tamanho adulto', tipo: 'texto', opcoes: null, obrigatorio: false, usar_em_filtro: false },
  { rotulo: 'pH ideal', tipo: 'texto', opcoes: null, obrigatorio: false, usar_em_filtro: false },
  { rotulo: 'Temperatura ideal', tipo: 'texto', opcoes: null, obrigatorio: false, usar_em_filtro: false },
]
const ATRIBUTOS_PLANTA = [
  { rotulo: 'Nível de luz', tipo: 'selecao', opcoes: ['Baixo', 'Médio', 'Alto'], obrigatorio: true, usar_em_filtro: true },
  { rotulo: 'CO2 necessário', tipo: 'booleano', opcoes: null, obrigatorio: false, usar_em_filtro: false },
  { rotulo: 'Dificuldade', tipo: 'selecao', opcoes: ['Fácil', 'Médio', 'Difícil'], obrigatorio: false, usar_em_filtro: false },
]
const ATRIBUTOS_RACAO = [
  { rotulo: 'Tipo', tipo: 'selecao', opcoes: ['Flocos', 'Pellets', 'Granulado'], obrigatorio: true, usar_em_filtro: true },
  { rotulo: 'Peso da embalagem', tipo: 'texto', opcoes: null, obrigatorio: false, usar_em_filtro: false },
]

const CATEGORIAS_COM_ATRIBUTOS = [
  ...NOVAS_SUBCATEGORIAS.map((s) => ({ nome: s.nome, lista: s.grupo === 'peixe' ? ATRIBUTOS_PEIXE : ATRIBUTOS_PLANTA })),
  { nome: 'Ração', lista: ATRIBUTOS_RACAO },
]

const ATTR_ID = {} // `${categoriaNome}::${rotulo}` -> attribute_id
for (const cat of CATEGORIAS_COM_ATRIBUTOS) {
  const categoryId = CATEGORIA_ID[cat.nome]
  let ordem = 0
  for (const attr of cat.lista) {
    const row = await must(
      supabase
        .from('category_attributes')
        .insert({
          tenant_id: TENANT_ID,
          category_id: categoryId,
          chave: slugify(attr.rotulo),
          rotulo: attr.rotulo,
          tipo: attr.tipo,
          opcoes: attr.opcoes,
          obrigatorio: attr.obrigatorio,
          usar_em_filtro: attr.usar_em_filtro,
          ordem: ordem++,
          ativo: true,
        })
        .select()
        .single(),
      `caracteristica ${cat.nome}/${attr.rotulo}`
    )
    ATTR_ID[`${cat.nome}::${attr.rotulo}`] = row.id
    manifest.category_attributes.push({ id: row.id, categoria: cat.nome, rotulo: attr.rotulo })
  }
  console.log(`características criadas em ${cat.nome}: ${cat.lista.map((a) => a.rotulo).join(', ')}`)
}

// ---------- 3. geração de código de produto (mesma sequência do painel) ----------
async function reservarCodigo(nomeProduto) {
  const prefixo = derivarPrefixo(nomeProduto)
  const existente = await must(
    supabase.from('product_code_sequences').select('ultimo_numero').eq('tenant_id', TENANT_ID).eq('prefixo', prefixo).maybeSingle(),
    `product_code_sequences ${prefixo}`
  )
  const numero = (existente?.ultimo_numero ?? 0) + 1
  if (existente) {
    await must(
      supabase.from('product_code_sequences').update({ ultimo_numero: numero, updated_at: new Date().toISOString() }).eq('tenant_id', TENANT_ID).eq('prefixo', prefixo),
      `update product_code_sequences ${prefixo}`
    )
  } else {
    await must(
      supabase.from('product_code_sequences').insert({ tenant_id: TENANT_ID, prefixo, ultimo_numero: numero }),
      `insert product_code_sequences ${prefixo}`
    )
  }
  return formatarCodigo(prefixo, numero)
}

// ---------- 4. SKU automático (mesma regra de abreviar_rotulo + sufixo numérico) ----------
function gerarSku(codigoProduto, rotulo, skusEmUso) {
  const base = `${codigoProduto}-${derivarPrefixo(rotulo)}`
  let candidato = base
  let sufixo = 1
  while (skusEmUso.has(candidato)) {
    sufixo += 1
    candidato = `${base}${sufixo}`
  }
  skusEmUso.add(candidato)
  return candidato
}

// ---------- 5. placeholder de imagem (cor sólida + nome, sharp -> webp) ----------
const CORES = ['#2f7d6b', '#1c4e80', '#a3512b', '#5b6b2f', '#7a3b69', '#3d6b8a', '#8a6a2f', '#4a4a7a']
function corParaIndice(i) {
  return CORES[i % CORES.length]
}
async function gerarPlaceholder(nomeProduto, cor) {
  const svg = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="800" fill="${cor}"/>
      <text x="400" y="400" font-family="sans-serif" font-size="42" fill="#ffffff"
            text-anchor="middle" dominant-baseline="middle">${escapeXml(nomeProduto)}</text>
      <text x="400" y="460" font-family="sans-serif" font-size="22" fill="#ffffffaa"
            text-anchor="middle" dominant-baseline="middle">Criatório Capuã — imagem provisória</text>
    </svg>`
  return sharp(Buffer.from(svg)).webp().toBuffer()
}
function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------- 6. catálogo (produtos + variações + características) ----------
const PRODUTOS = [
  {
    nome: 'Acará Disco Azul', categoria: 'Acarás', destaque: true, codigoVisivel: true,
    descricao: 'Ciclídeo de corpo discoide e coloração azul intensa, ótimo destaque para aquários comunitários maiores.',
    caracteristicas: { Temperamento: 'Semi-agressivo', 'Tamanho adulto': '15-20cm', 'pH ideal': '6.0-7.0', 'Temperatura ideal': '28-30°C' },
    variacoes: [
      { rotulo: 'Pequeno', preco: 45, estoqueInicial: 12 },
      { rotulo: 'Médio', preco: 75, promo: 65, estoqueInicial: 6 },
    ],
  },
  {
    nome: 'Acará Bandeira Prata', categoria: 'Acarás', destaque: false, codigoVisivel: true,
    descricao: 'Acará-bandeira (angelfish) prateado clássico, temperamento tranquilo, boa opção para comunitário.',
    caracteristicas: { Temperamento: 'Pacífico', 'Tamanho adulto': '12-15cm', 'pH ideal': '6.5-7.5', 'Temperatura ideal': '26-28°C' },
    variacoes: [{ rotulo: 'Padrão', preco: 18, estoqueInicial: 20 }],
  },
  {
    nome: 'Acará Bandeira Marmorizado', categoria: 'Acarás', destaque: false, codigoVisivel: true,
    descricao: 'Variedade marmorizada do acará-bandeira, padrão de manchas único em cada exemplar.',
    caracteristicas: { Temperamento: 'Pacífico', 'Tamanho adulto': '12-15cm', 'pH ideal': '6.5-7.5' },
    variacoes: [{ rotulo: 'Padrão', preco: 22, promo: 19, estoqueInicial: 0 }],
  },
  {
    nome: 'Oscar Tigre', categoria: 'Oscars', destaque: false, codigoVisivel: true,
    descricao: 'Oscar de padrão tigrado, ciclídeo robusto de grande porte, exige aquário espaçoso.',
    caracteristicas: { Temperamento: 'Agressivo', 'Tamanho adulto': '25-30cm', 'pH ideal': '6.0-8.0', 'Temperatura ideal': '23-27°C' },
    variacoes: [{ rotulo: 'Padrão', preco: 55, estoqueInicial: 8 }],
  },
  {
    nome: 'Oscar Albino', categoria: 'Oscars', destaque: false, codigoVisivel: true,
    descricao: 'Oscar albino, coloração clara com manchas alaranjadas, mesmo porte e cuidados do oscar comum.',
    caracteristicas: { Temperamento: 'Agressivo', 'Tamanho adulto': '25-30cm', 'pH ideal': '6.0-8.0' },
    variacoes: [{ rotulo: 'Padrão', preco: 68, estoqueInicial: 0 }],
  },
  {
    nome: 'Apistogramma Cacatuoides', categoria: 'Ciclídeos Anões', destaque: false, codigoVisivel: false,
    descricao: 'Ciclídeo anão colorido, ótimo para aquários plantados de menor porte, vendido em casal.',
    caracteristicas: { Temperamento: 'Semi-agressivo', 'Tamanho adulto': '6-8cm', 'pH ideal': '5.5-6.5', 'Temperatura ideal': '25-28°C' },
    variacoes: [{ rotulo: 'Casal', preco: 40, estoqueInicial: 10, unidade: 'Dupla' }],
  },
  {
    nome: 'Ram Balão', categoria: 'Ciclídeos Anões', destaque: false, codigoVisivel: false,
    descricao: 'Ciclídeo anão de corpo arredondado, colorido e pacífico, indicado para comunitário plantado.',
    caracteristicas: { Temperamento: 'Pacífico', 'Tamanho adulto': '5cm', 'pH ideal': '6.0-7.0' },
    variacoes: [{ rotulo: 'Padrão', preco: 25, estoqueInicial: 15 }],
  },
  {
    nome: 'Betta Halfmoon Vermelho', categoria: 'Beta Halfmoon', destaque: true, codigoVisivel: true,
    descricao: 'Betta halfmoon de nadadeiras em meia-lua e coloração vermelha vibrante.',
    caracteristicas: { Temperamento: 'Agressivo', 'Tamanho adulto': '6-7cm', 'pH ideal': '6.5-7.5', 'Temperatura ideal': '25-28°C' },
    variacoes: [{ rotulo: 'Padrão', preco: 35, promo: 29.9, estoqueInicial: 7 }],
  },
  {
    nome: 'Betta Halfmoon Azul Royal', categoria: 'Beta Halfmoon', destaque: false, codigoVisivel: true,
    descricao: 'Betta halfmoon azul royal, nadadeiras amplas em meia-lua, exemplar de destaque solo.',
    caracteristicas: { Temperamento: 'Agressivo', 'Tamanho adulto': '6-7cm', 'pH ideal': '6.5-7.5' },
    variacoes: [{ rotulo: 'Padrão', preco: 38, estoqueInicial: 5 }],
  },
  {
    nome: 'Betta Plakat Amarelo', categoria: 'Beta Plakat', destaque: false, codigoVisivel: true,
    descricao: 'Betta plakat de nadadeiras curtas, mais resistente, coloração amarela vibrante.',
    caracteristicas: { Temperamento: 'Agressivo', 'Tamanho adulto': '5-6cm', 'pH ideal': '6.5-7.5' },
    variacoes: [{ rotulo: 'Padrão', preco: 30, estoqueInicial: 9 }],
  },
  {
    nome: 'Betta Plakat Cambodia', categoria: 'Beta Plakat', destaque: false, codigoVisivel: true,
    descricao: 'Betta plakat padrão Cambodia (corpo claro, nadadeiras coloridas), nadadeiras curtas.',
    caracteristicas: { Temperamento: 'Agressivo', 'Tamanho adulto': '5-6cm' },
    variacoes: [{ rotulo: 'Padrão', preco: 32, estoqueInicial: 0 }],
  },
  {
    nome: 'Anúbia Nana', categoria: 'Plantas de Fundo', destaque: false, codigoVisivel: false,
    descricao: 'Planta de fundo de baixa exigência, ótima para fixar em troncos e pedras.',
    caracteristicas: { 'Nível de luz': 'Baixo', 'CO2 necessário': 'false', Dificuldade: 'Fácil' },
    variacoes: [
      { rotulo: 'Vaso Pequeno', preco: 15, estoqueInicial: 25 },
      { rotulo: 'Vaso Grande', preco: 28, estoqueInicial: 10 },
    ],
  },
  {
    nome: 'Cryptocoryne Wendtii', categoria: 'Plantas de Fundo', destaque: false, codigoVisivel: false,
    descricao: 'Planta de fundo resistente, folhas onduladas em tons de verde a marrom-avermelhado.',
    caracteristicas: { 'Nível de luz': 'Médio', Dificuldade: 'Fácil' },
    variacoes: [{ rotulo: 'Padrão', preco: 12, estoqueInicial: 30 }],
  },
  {
    nome: 'Java Fern', categoria: 'Plantas de Fundo', destaque: true, codigoVisivel: false,
    descricao: 'Samambaia-de-java, planta rústica que fixa em troncos/pedras, dispensa substrato fértil.',
    caracteristicas: { 'Nível de luz': 'Baixo', 'CO2 necessário': 'false', Dificuldade: 'Fácil' },
    variacoes: [{ rotulo: 'Padrão', preco: 14, promo: 11.9, estoqueInicial: 18 }],
  },
  {
    nome: 'Salvínia Natans', categoria: 'Plantas Flutuantes', destaque: false, codigoVisivel: false,
    descricao: 'Planta flutuante de crescimento rápido, ajuda a reduzir luminosidade e absorver nitrato.',
    caracteristicas: { 'Nível de luz': 'Alto', 'CO2 necessário': 'false', Dificuldade: 'Fácil' },
    variacoes: [{ rotulo: 'Punhado', preco: 9.9, estoqueInicial: 40, unidade: 'Pacote' }],
  },
  {
    nome: "Alface D'água", categoria: 'Plantas Flutuantes', destaque: false, codigoVisivel: false,
    descricao: 'Planta flutuante de folhas aveludadas, sombreamento natural e refúgio para alevinos.',
    caracteristicas: { 'Nível de luz': 'Alto', Dificuldade: 'Fácil' },
    variacoes: [{ rotulo: 'Unidade', preco: 6.5, estoqueInicial: 50 }],
  },
  {
    nome: 'Ração em Flocos Coloridos', categoria: 'Ração', destaque: false, codigoVisivel: false,
    descricao: 'Ração em flocos com corantes naturais, realça a coloração de peixes ornamentais.',
    caracteristicas: { Tipo: 'Flocos', 'Peso da embalagem': 'Disponível em 20g e 100g' },
    variacoes: [
      { rotulo: '20g', preco: 8.9, estoqueInicial: 30 },
      { rotulo: '100g', preco: 32.9, promo: 28.9, estoqueInicial: 12 },
    ],
  },
  {
    nome: 'Ração em Flocos Tropical', categoria: 'Ração', destaque: false, codigoVisivel: false,
    descricao: 'Ração em flocos para peixes tropicais em geral, mix balanceado de nutrientes.',
    caracteristicas: { Tipo: 'Flocos', 'Peso da embalagem': 'Disponível em 20g e 100g' },
    variacoes: [
      { rotulo: '20g', preco: 9.9, estoqueInicial: 25 },
      { rotulo: '100g', preco: 34.9, estoqueInicial: 0 },
    ],
  },
  {
    nome: 'Ração em Pellets', categoria: 'Ração', destaque: true, codigoVisivel: false,
    descricao: 'Ração em pellets de afundamento lento, indicada para ciclídeos de médio/grande porte.',
    caracteristicas: { Tipo: 'Pellets', 'Peso da embalagem': '100g' },
    variacoes: [{ rotulo: 'Padrão 100g', preco: 27.9, estoqueInicial: 20 }],
  },
  {
    nome: 'Ração Granulada para Filhotes', categoria: 'Ração', destaque: false, codigoVisivel: false,
    descricao: 'Ração granulada fina, formulada para alevinos e peixes filhotes.',
    caracteristicas: { Tipo: 'Granulado', 'Peso da embalagem': '50g' },
    variacoes: [{ rotulo: 'Padrão 50g', preco: 19.9, estoqueInicial: 14 }],
  },
]

let contadorImagem = 0
for (const p of PRODUTOS) {
  const categoryId = CATEGORIA_ID[p.categoria]
  const slug = slugify(p.nome)
  const codigo = await reservarCodigo(p.nome)

  const produtoRow = await must(
    supabase
      .from('products')
      .insert({
        tenant_id: TENANT_ID,
        category_id: categoryId,
        nome: p.nome,
        slug,
        descricao: p.descricao,
        unidade_venda_id: UNIDADE['Unidade'],
        destaque: p.destaque,
        ativo: true,
        codigo,
        codigo_visivel: p.codigoVisivel,
      })
      .select()
      .single(),
    `produto ${p.nome}`
  )
  manifest.products.push({ id: produtoRow.id, nome: p.nome, codigo, categoria: p.categoria })
  console.log(`produto criado: ${p.nome} (${codigo})`)

  const skusEmUso = new Set()
  let ordemVar = 0
  for (const v of p.variacoes) {
    const sku = gerarSku(codigo, v.rotulo, skusEmUso)
    const unidadeVariacao = v.unidade ? UNIDADE[v.unidade] : null // so' informativo aqui, unidade e' por produto
    const variantRow = await must(
      supabase
        .from('product_variants')
        .insert({
          tenant_id: TENANT_ID,
          product_id: produtoRow.id,
          nome: v.rotulo,
          sku,
          preco: v.preco,
          preco_promocional: v.promo ?? null,
          modo_estoque: 'quantitativo',
          saldo_estoque: 0,
          quantidade_minima_estoque: 1,
          quantidade_minima_venda: 1,
          ordem: ordemVar++,
          ativo: true,
        })
        .select()
        .single(),
      `variação ${p.nome}/${v.rotulo}`
    )
    manifest.product_variants.push({ id: variantRow.id, produto: p.nome, rotulo: v.rotulo, sku })

    if (v.estoqueInicial > 0) {
      await must(
        supabase.from('stock_movements').insert({
          tenant_id: TENANT_ID,
          variant_id: variantRow.id,
          product_id: produtoRow.id,
          tipo: 'inventario',
          quantidade: v.estoqueInicial,
          saldo_anterior: 0,
          saldo_novo: v.estoqueInicial,
          motivo: 'Estoque inicial - seed Vitrine Fase 1, Etapa 1 (dados de teste, HML)',
          usuario_id: null,
        }),
        `stock_movement ${p.nome}/${v.rotulo}`
      )
      await must(
        supabase.from('product_variants').update({ saldo_estoque: v.estoqueInicial }).eq('id', variantRow.id),
        `update saldo_estoque ${p.nome}/${v.rotulo}`
      )
      manifest.stock_movements.push({ variant_id: variantRow.id, produto: p.nome, rotulo: v.rotulo, quantidade: v.estoqueInicial })
    }
  }

  // características
  for (const [rotulo, valor] of Object.entries(p.caracteristicas)) {
    const attributeId = ATTR_ID[`${p.categoria}::${rotulo}`]
    if (!attributeId) throw new Error(`Característica não encontrada: ${p.categoria}/${rotulo}`)
    const pavRow = await must(
      supabase
        .from('product_attribute_values')
        .insert({ tenant_id: TENANT_ID, product_id: produtoRow.id, attribute_id: attributeId, valor: String(valor) })
        .select()
        .single(),
      `característica ${p.nome}/${rotulo}`
    )
    manifest.product_attribute_values.push({ id: pavRow.id, produto: p.nome, rotulo, valor: String(valor) })
  }

  // imagem placeholder
  const cor = corParaIndice(contadorImagem++)
  const buffer = await gerarPlaceholder(p.nome, cor)
  const imageId = crypto.randomUUID()
  const storagePath = `${TENANT_ID}/${produtoRow.id}/${imageId}.webp`
  const { error: uploadError } = await supabase.storage.from('product-images').upload(storagePath, buffer, {
    contentType: 'image/webp',
    upsert: false,
  })
  if (uploadError) throw new Error(`upload imagem ${p.nome}: ${uploadError.message}`)
  const imageRow = await must(
    supabase
      .from('product_images')
      .insert({
        id: imageId,
        tenant_id: TENANT_ID,
        product_id: produtoRow.id,
        variant_id: null,
        storage_path: storagePath,
        alt_text: p.nome,
        principal: true,
        ordem: 0,
      })
      .select()
      .single(),
    `product_images ${p.nome}`
  )
  manifest.product_images.push({ id: imageRow.id, produto: p.nome, storage_path: storagePath })
}

writeFileSync('docs/vitrine_fase1_seed_manifest.json', JSON.stringify(manifest, null, 2))

console.log('\n=== RESUMO ===')
console.log('Categorias novas:', manifest.categorias.length)
console.log('Características criadas:', manifest.category_attributes.length)
console.log('Produtos criados:', manifest.products.length)
console.log('Variações criadas:', manifest.product_variants.length)
console.log('Movimentações de estoque inicial:', manifest.stock_movements.length)
console.log('Valores de característica preenchidos:', manifest.product_attribute_values.length)
console.log('Imagens enviadas:', manifest.product_images.length)
console.log('\nManifesto salvo em docs/vitrine_fase1_seed_manifest.json')
