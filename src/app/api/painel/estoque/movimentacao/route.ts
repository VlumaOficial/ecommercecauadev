import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// "inventario" fica de fora de proposito - reservado ao sistema
// (estoque inicial no cadastro do produto), nunca selecionavel manualmente
// aqui. A RPC (021) tambem recusa se alguem tentar via payload direto -
// esta validacao no client e so a primeira camada, nao a unica.
const movimentacaoSchema = z
  .object({
    variant_id: z.string().uuid('Variação inválida.'),
    tipo: z.enum(['entrada', 'saida', 'ajuste', 'devolucao']),
    quantidade: z.coerce.number().int().optional(),
    saldo_novo_desejado: z.coerce.number().int().min(0).optional(),
    motivo: z.string().trim().optional().default(''),
  })
  .refine((v) => v.tipo !== 'ajuste' || v.motivo.length > 0, {
    message: 'Informe o motivo do ajuste.',
    path: ['motivo'],
  })

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = movimentacaoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  const { variant_id, tipo, quantidade, saldo_novo_desejado, motivo } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('registrar_movimentacao_estoque', {
    p_variant_id: variant_id,
    p_tipo: tipo,
    p_quantidade: quantidade ?? null,
    p_saldo_novo_desejado: saldo_novo_desejado ?? null,
    p_motivo: motivo || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
