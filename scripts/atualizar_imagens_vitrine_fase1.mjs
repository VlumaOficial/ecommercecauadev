// Substitui as imagens placeholder (cor solida) da Vitrine Fase 1,
// Etapa 1 por fotos reais e genericas por especie/tipo, buscadas no
// Wikimedia Commons (acervo de imagens livres/CC). Sao imagens de
// TESTE - servem pra validar a galeria/cards da vitrine na Etapa 2;
// as fotos reais dos produtos do Cauã virao depois.
//
// Nao faz re-seed nenhum: le o manifesto (docs/vitrine_fase1_seed_
// manifest.json) pra saber o storage_path exato de cada imagem ja
// criada, baixa a foto, converte pra webp (mesmo padrao do bucket) e
// SOBRESCREVE o mesmo objeto no Storage (upsert:true) - a linha em
// product_images nao muda (mesmo storage_path, mesmo id), so o
// conteudo do arquivo.
//
// Registra credito (autor/licenca/URL da fonte) de cada imagem
// escolhida num arquivo de creditos separado, para rastreabilidade -
// imagens CC-BY/CC-BY-SA do Wikimedia Commons pedem atribuicao se
// forem usadas em producao; como sao so dados de teste em HML, a
// atribuicao nao aparece na tela, mas fica registrada aqui.

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

const manifest = JSON.parse(readFileSync('docs/vitrine_fase1_seed_manifest.json', 'utf8'))

// termo de busca no Commons por produto (especie quando aplicavel,
// generico por tipo quando nao ha foto de especie exata razoavel)
const BUSCA_POR_PRODUTO = {
  'Acará Disco Azul': 'Symphysodon discus blue aquarium',
  'Acará Bandeira Prata': 'Pterophyllum scalare silver angelfish aquarium',
  'Acará Bandeira Marmorizado': 'Pterophyllum scalare marble angelfish',
  'Oscar Tigre': 'Astronotus ocellatus tiger oscar fish',
  'Oscar Albino': 'Astronotus ocellatus albino oscar fish',
  'Apistogramma Cacatuoides': 'Apistogramma cacatuoides aquarium',
  'Ram Balão': 'Mikrogeophagus altispinosus bolivian ram',
  'Betta Halfmoon Vermelho': 'Betta splendens red halfmoon',
  'Betta Halfmoon Azul Royal': 'Betta splendens blue halfmoon',
  'Betta Plakat Amarelo': 'Betta splendens yellow plakat',
  'Betta Plakat Cambodia': 'Betta splendens cambodia',
  'Anúbia Nana': 'Anubias barteri nana aquarium plant',
  'Cryptocoryne Wendtii': 'Cryptocoryne wendtii aquarium plant',
  'Java Fern': 'Microsorum pteropus java fern aquarium',
  'Salvínia Natans': 'Salvinia natans floating plant',
  "Alface D'água": 'Pistia stratiotes water lettuce plant',
  'Ração em Flocos Coloridos': 'tropical fish flakes food',
  'Ração em Flocos Tropical': 'fish flake food aquarium',
  'Ração em Pellets': 'fish food pellets aquarium',
  'Ração Granulada para Filhotes': 'fish fry food granules',
}

async function commonsSearch(query, limit = 8) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&srnamespace=6&format=json&srlimit=${limit}`
  const res = await fetch(url, { headers: { 'User-Agent': 'vluma-seed-script/1.0 (contato@vluma.com.br)' } })
  const json = await res.json()
  return (json.query?.search ?? []).map((r) => r.title)
}

async function commonsImageInfo(title, width = 900) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    title
  )}&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=${width}&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'vluma-seed-script/1.0 (contato@vluma.com.br)' } })
  const json = await res.json()
  const pages = json.query?.pages ?? {}
  const page = Object.values(pages)[0]
  return page?.imageinfo?.[0] ?? null
}

async function escolherImagem(query) {
  const titulos = await commonsSearch(query)
  for (const titulo of titulos) {
    const info = await commonsImageInfo(titulo)
    if (!info) continue
    const mime = info.mime ?? ''
    const largura = info.width ?? 0
    if ((mime === 'image/jpeg' || mime === 'image/png') && largura >= 400) {
      return {
        titulo,
        thumburl: info.thumburl ?? info.url,
        autor: (info.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || 'desconhecido',
        licenca: info.extmetadata?.LicenseShortName?.value ?? 'desconhecida',
        fonte: info.descriptionurl,
      }
    }
  }
  return null
}

const creditos = []
let atualizados = 0
let falhas = []

for (const img of manifest.product_images) {
  const query = BUSCA_POR_PRODUTO[img.produto]
  if (!query) {
    console.log(`SEM BUSCA DEFINIDA: ${img.produto} - pulando`)
    falhas.push(img.produto)
    continue
  }

  const escolha = await escolherImagem(query)
  if (!escolha) {
    console.log(`NENHUMA IMAGEM ENCONTRADA: ${img.produto} (busca: "${query}")`)
    falhas.push(img.produto)
    continue
  }

  const resFile = await fetch(escolha.thumburl, { headers: { 'User-Agent': 'vluma-seed-script/1.0 (contato@vluma.com.br)' } })
  const arrayBuffer = await resFile.arrayBuffer()
  const webpBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize({ width: 1000, height: 1000, fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer()

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(img.storage_path, webpBuffer, { contentType: 'image/webp', upsert: true })

  if (uploadError) {
    console.log(`ERRO NO UPLOAD: ${img.produto} - ${uploadError.message}`)
    falhas.push(img.produto)
    continue
  }

  console.log(`atualizado: ${img.produto} <- "${escolha.titulo}" (${escolha.licenca}, ${escolha.autor})`)
  creditos.push({ produto: img.produto, storage_path: img.storage_path, ...escolha })
  atualizados++
}

writeFileSync(
  'docs/vitrine_fase1_creditos_imagens.json',
  JSON.stringify(
    {
      gerado_em: new Date().toISOString(),
      descricao:
        'Creditos das imagens de teste (Wikimedia Commons, licenca livre) usadas na Vitrine Fase 1 Etapa 1 - trocar por fotos reais do Cauã antes de producao, ou manter atribuicao se ficarem.',
      creditos,
      falhas,
    },
    null,
    2
  )
)

console.log(`\n=== RESUMO === atualizadas: ${atualizados} / ${manifest.product_images.length}, falhas: ${falhas.length}`)
if (falhas.length) console.log('Falhas:', falhas)
