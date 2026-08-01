import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { formatarCodigo } from '@/lib/produto-codigo'

// Peek: mostra qual seria o proximo codigo automatico SEM reservar
// nada (nao chama a RPC gerar_codigo_produto, que incrementa a
// sequencia de verdade). So leitura simples - RLS de authenticated
// (pos-014) ja garante que so enxerga a propria categoria do tenant.
export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')?.trim() ?? ''
  if (!categoryId) {
    return NextResponse.json({ error: 'Categoria não informada.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: categoria, error: categoriaError } = await supabase
    .from('categories')
    .select('prefixo_codigo')
    .eq('id', categoryId)
    .single()

  if (categoriaError || !categoria) {
    return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 })
  }

  if (!categoria.prefixo_codigo) {
    return NextResponse.json(
      { error: 'Esta categoria ainda não tem um prefixo de código. Abra o cadastro da categoria e salve para gerá-lo.' },
      { status: 400 }
    )
  }

  const { data: sequencia } = await supabase
    .from('category_code_sequences')
    .select('ultimo_numero')
    .eq('category_id', categoryId)
    .maybeSingle()

  const proximoNumero = (sequencia?.ultimo_numero ?? 0) + 1
  const codigo = formatarCodigo(categoria.prefixo_codigo, proximoNumero)

  return NextResponse.json({ data: { codigo, prefixo: categoria.prefixo_codigo } })
}
