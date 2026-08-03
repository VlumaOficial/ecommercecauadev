import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp'])
// Mesma trava do bucket (migration 023, file_size_limit) - defesa em
// profundidade, nunca confiar so no client.
const TAMANHO_MAXIMO = 5 * 1024 * 1024
const LIMITE_PRODUTO = 10
const LIMITE_VARIACAO = 5

// Upload de imagem: sobe pro Storage no path {tenant_id}/{product_id}/
// {id}.webp e grava a linha em product_images na sequencia. Se o
// insert falhar depois do upload ter dado certo, remove o arquivo do
// Storage - evita deixar objeto orfao sem linha nenhuma apontando pra ele.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id: productId } = await params
  const supabase = await createClient()

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const file = formData.get('file')
  const variantId = (formData.get('variant_id') as string | null) || null
  const altText = (formData.get('alt_text') as string | null)?.trim() || null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Selecione uma imagem.' }, { status: 400 })
  }
  if (!TIPOS_PERMITIDOS.has(file.type)) {
    return NextResponse.json({ error: 'Formato não suportado. Use JPG, PNG ou WebP.' }, { status: 400 })
  }
  if (file.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: 'A imagem é muito grande (máximo 5MB).' }, { status: 400 })
  }

  const { data: produto, error: produtoError } = await supabase
    .from('products')
    .select('id, tenant_id')
    .eq('id', productId)
    .single()

  if (produtoError || !produto) {
    return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
  }

  if (variantId) {
    const { data: variante, error: varianteError } = await supabase
      .from('product_variants')
      .select('id')
      .eq('id', variantId)
      .eq('product_id', productId)
      .maybeSingle()

    if (varianteError || !variante) {
      return NextResponse.json({ error: 'Variação não encontrada.' }, { status: 404 })
    }
  }

  let contagemQuery = supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
  contagemQuery = variantId ? contagemQuery.eq('variant_id', variantId) : contagemQuery.is('variant_id', null)

  const { count, error: countError } = await contagemQuery
  if (countError) {
    return NextResponse.json(
      { error: 'Não foi possível validar o limite de imagens. Tente novamente.' },
      { status: 400 }
    )
  }

  const limite = variantId ? LIMITE_VARIACAO : LIMITE_PRODUTO
  if ((count ?? 0) >= limite) {
    return NextResponse.json(
      {
        error: variantId
          ? `Limite de ${LIMITE_VARIACAO} imagens por variação atingido.`
          : `Limite de ${LIMITE_PRODUTO} imagens por produto atingido.`,
      },
      { status: 400 }
    )
  }

  const imageId = crypto.randomUUID()
  const storagePath = `${produto.tenant_id}/${productId}/${imageId}.webp`

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(storagePath, file, { contentType: 'image/webp', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Não foi possível enviar a imagem. Tente novamente.' }, { status: 400 })
  }

  const { data: imagem, error: insertError } = await supabase
    .from('product_images')
    .insert({
      id: imageId,
      product_id: productId,
      variant_id: variantId,
      storage_path: storagePath,
      alt_text: altText,
      ordem: count ?? 0,
    })
    .select()
    .single()

  if (insertError) {
    await supabase.storage.from('product-images').remove([storagePath])
    return NextResponse.json({ error: 'Não foi possível salvar a imagem. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json({ data: imagem }, { status: 201 })
}
