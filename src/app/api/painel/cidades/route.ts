import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

const cidadeInputSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da cidade.'),
  uf: z.string().trim().length(2, 'Selecione a UF.'),
  ponto_entrega: z.string().trim().optional().default(''),
  horario: z.string().trim().optional().default(''),
  observacoes: z.string().trim().optional().default(''),
  ativo: z.boolean().optional().default(true),
})

export async function GET(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'ativos'
  const busca = searchParams.get('busca')?.trim() ?? ''

  const supabase = await createClient()
  let query = supabase
    .from('delivery_cities')
    .select('*')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  if (status === 'ativos') query = query.eq('ativo', true)
  else if (status === 'inativos') query = query.eq('ativo', false)
  if (busca) query = query.ilike('nome', `%${busca}%`)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = cidadeInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados invalidos.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delivery_cities')
    .insert({
      nome: parsed.data.nome,
      uf: parsed.data.uf,
      ponto_entrega: parsed.data.ponto_entrega || null,
      horario: parsed.data.horario || null,
      observacoes: parsed.data.observacoes || null,
      ativo: parsed.data.ativo,
    })
    .select()
    .single()

  if (error) {
    const message = error.code === '23505' ? 'Ja existe uma cidade com esse nome.' : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
