import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { derivarPrefixo, formatarCodigo } from '@/lib/produto-codigo'

// Peek: mostra qual seria o proximo codigo SEM reservar nada (nao
// chama nenhuma RPC de reserva, que incrementa a sequencia de
// verdade). So leitura simples - RLS de authenticated (pos-014) ja
// garante que so enxerga a propria sequencia/categoria do tenant.
//
// Dois modos (modo=nome ganhou na migration 024 - decisao #24):
// - modo=nome: prefixo derivado do NOME DO PRODUTO (derivarPrefixo,
//   mesma funcao usada na derivacao de prefixo de categoria - fonte
//   unica, nao duplicada aqui), sequencia em product_code_sequences
//   (chaveada por prefixo, nao por produto/categoria).
// - modo=categoria (default, compatibilidade com o comportamento
//   anterior): prefixo da categoria, sequencia em
//   category_code_sequences - inalterado desde a migration 016.
export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const modo = searchParams.get('modo') ?? 'categoria'
  const supabase = await createClient()

  if (modo === 'nome') {
    const nome = searchParams.get('nome')?.trim() ?? ''
    if (!nome) {
      return NextResponse.json({ error: 'Informe o nome do produto.' }, { status: 400 })
    }

    const prefixo = derivarPrefixo(nome)
    if (!prefixo) {
      return NextResponse.json(
        { error: 'Não foi possível gerar um código a partir deste nome.' },
        { status: 400 }
      )
    }

    const { data: sequencia } = await supabase
      .from('product_code_sequences')
      .select('ultimo_numero')
      .eq('prefixo', prefixo)
      .maybeSingle()

    const proximoNumero = (sequencia?.ultimo_numero ?? 0) + 1
    const codigo = formatarCodigo(prefixo, proximoNumero)

    return NextResponse.json({ data: { codigo, prefixo } })
  }

  const categoryId = searchParams.get('category_id')?.trim() ?? ''
  if (!categoryId) {
    return NextResponse.json({ error: 'Categoria não informada.' }, { status: 400 })
  }

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
