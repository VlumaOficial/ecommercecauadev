import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Frente A (Gestão de Catálogo em Escala), incremento 3 - aprovado pelo
// PO em 04/09/2026. Único endpoint NOVO deste incremento - o upload em
// massa reaproveita as rotas de imagem já existentes (POST/DELETE/
// reorder), chamadas pelo browser uma vez por arquivo/SKU. Esta rota só
// devolve o mapeamento sku -> {produto, variação, fotos atuais} pra o
// browser casar os nomes dos arquivos localmente (mesmo padrão "busca
// tudo de uma vez" do Inc 1/2 - volume baixo, ~86 variações no tenant).
//
// Sem filtro de `ativo`: foto não é governada por status ativo/inativo
// da variação - o lojista pode querer anexar foto a uma variação
// temporariamente inativa. RLS (customers_select_own-equivalente de
// product_variants/product_images) já isola por tenant, sem precisar
// filtrar tenant_id manualmente aqui.
export async function GET() {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const supabase = await createClient()
  const [{ data: variantes, error: erroVariantes }, { data: imagens, error: erroImagens }] = await Promise.all([
    supabase.from('product_variants').select('id, product_id, sku').not('sku', 'is', null),
    supabase.from('product_images').select('id, variant_id, ordem').not('variant_id', 'is', null).order('ordem', { ascending: true }),
  ])

  if (erroVariantes || erroImagens) {
    return NextResponse.json({ error: 'Não foi possível carregar os SKUs. Tente novamente.' }, { status: 400 })
  }

  const imagensPorVariante = new Map<string, { id: string; ordem: number }[]>()
  for (const img of imagens ?? []) {
    const lista = imagensPorVariante.get(img.variant_id!) ?? []
    lista.push({ id: img.id, ordem: img.ordem })
    imagensPorVariante.set(img.variant_id!, lista)
  }

  const mapa = (variantes ?? [])
    .filter((v): v is typeof v & { sku: string } => !!v.sku)
    .map((v) => ({
      sku: v.sku,
      product_id: v.product_id,
      variant_id: v.id,
      imagens: imagensPorVariante.get(v.id) ?? [],
    }))

  return NextResponse.json({ mapa })
}
