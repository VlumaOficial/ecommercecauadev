import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Contagem de produtos por categoria, respeitando o filtro de status
// atual da listagem (Ativos/Inativos/Todos) - usado pelo filtro em
// arvore de categoria em /painel/produtos, pra mostrar quantos
// produtos cada categoria tem sem precisar entrar nela. Sem GROUP BY
// no banco de proposito: o volume de produtos de uma loja deste porte
// nao justifica uma view/RPC nova so pra isso, um reduce em JS sobre
// "category_id" resolve com uma unica query leve.
export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const status = new URL(request.url).searchParams.get('status') ?? 'ativos'
  const supabase = await createClient()

  let query = supabase.from('products_com_status').select('category_id')
  if (status === 'ativos') query = query.eq('ativo', true)
  else if (status === 'inativos') query = query.eq('ativo', false)

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: 'Não foi possível carregar a contagem de produtos por categoria.' },
      { status: 400 }
    )
  }

  const contagem: Record<string, number> = {}
  for (const row of data ?? []) {
    if (!row.category_id) continue
    contagem[row.category_id] = (contagem[row.category_id] ?? 0) + 1
  }

  return NextResponse.json({ data: contagem })
}
