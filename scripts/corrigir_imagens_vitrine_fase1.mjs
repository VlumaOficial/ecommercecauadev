// Correcao pontual de 8 imagens da Vitrine Fase 1 (5 que a busca
// automatica em atualizar_imagens_vitrine_fase1.mjs nao encontrou +
// 3 que encontrou mas eram matches ruins, verificados visualmente:
// camarao no lugar de racao em pellets, gravura antiga de livro de
// 1908 no lugar de flocos, nadadeira azul duplicada rotulada como
// "amarelo"). Titulos escolhidos a dedo no Wikimedia Commons depois
// de inspecao visual das opcoes. Mesmo mecanismo de sobrescrita
// (upsert no mesmo storage_path do manifesto, sem mudar a linha em
// product_images).

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
const UA = { 'User-Agent': 'vluma-seed-script/1.0 (contato@vluma.com.br)' }

const TITULO_POR_PRODUTO = {
  'Acará Bandeira Prata': 'File:Silverangelfish.jpg',
  'Apistogramma Cacatuoides': 'File:Adult male Apistogramma Cacatuoides.jpg',
  'Java Fern': 'File:Java Fern (Microsorum pteropus) growing in the wild..jpg',
  'Betta Plakat Amarelo': 'File:Super Yellow PKHM from WorldBettas.jpg',
  'Ração em Flocos Coloridos': 'File:Fischfutter-Flocken.JPG',
  'Ração em Flocos Tropical': 'File:Aquarium - dried food.jpg',
  'Ração em Pellets': 'File:Fischfutter-Tabs.JPG',
  'Ração Granulada para Filhotes': 'File:Aquarium - dried food.jpg',
}

async function commonsImageInfo(title, width = 1000) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    title
  )}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${width}&format=json`
  const res = await fetch(url, { headers: UA })
  const json = await res.json()
  const page = Object.values(json.query?.pages ?? {})[0]
  return page?.imageinfo?.[0] ?? null
}

const creditosExistentes = JSON.parse(readFileSync('docs/vitrine_fase1_creditos_imagens.json', 'utf8'))
const creditosPorProduto = Object.fromEntries(creditosExistentes.creditos.map((c) => [c.produto, c]))

let corrigidos = 0
for (const [produto, titulo] of Object.entries(TITULO_POR_PRODUTO)) {
  const img = manifest.product_images.find((i) => i.produto === produto)
  if (!img) {
    console.log(`AVISO: ${produto} não encontrado no manifesto`)
    continue
  }
  const info = await commonsImageInfo(titulo)
  if (!info) {
    console.log(`AVISO: não achou imageinfo para ${titulo}`)
    continue
  }
  const resFile = await fetch(info.thumburl ?? info.url, { headers: UA })
  const arrayBuffer = await resFile.arrayBuffer()
  const webpBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize({ width: 1000, height: 1000, fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer()

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(img.storage_path, webpBuffer, { contentType: 'image/webp', upsert: true })

  if (uploadError) {
    console.log(`ERRO: ${produto} - ${uploadError.message}`)
    continue
  }

  const autor = (info.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || 'desconhecido'
  const licenca = info.extmetadata?.LicenseShortName?.value ?? 'desconhecida'
  creditosPorProduto[produto] = { produto, storage_path: img.storage_path, titulo, autor, licenca, fonte: info.descriptionurl }
  console.log(`corrigido: ${produto} <- "${titulo}" (${licenca}, ${autor})`)
  corrigidos++
}

const creditosFinais = Object.values(creditosPorProduto)
writeFileSync(
  'docs/vitrine_fase1_creditos_imagens.json',
  JSON.stringify(
    {
      gerado_em: creditosExistentes.gerado_em,
      atualizado_em: new Date().toISOString(),
      descricao: creditosExistentes.descricao,
      creditos: creditosFinais,
      falhas: [],
    },
    null,
    2
  )
)

console.log(`\n=== ${corrigidos}/${Object.keys(TITULO_POR_PRODUTO).length} imagens corrigidas ===`)
