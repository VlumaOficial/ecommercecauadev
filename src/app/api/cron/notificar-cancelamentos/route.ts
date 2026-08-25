import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notificarPedido } from '@/lib/notificacoes/notificar-pedido'

// Roda SEM sessao de staff - chamada pelo GitHub Action cron
// (.github/workflows/cancelar-pedidos-expirados.yml), autenticada
// por um segredo compartilhado (CRON_SECRET), nao por login. Chama
// cancelar_pedidos_expirados() (migration 042, agora service-role-only
// e devolve os pedidos afetados, nao so' a contagem) via service
// role, e notifica cada cliente cancelado. Devolve um resumo no
// corpo da resposta (pedido do PO, 25/08/2026) - o log efemero de
// console nao seria visto por ninguem no caminho automatico, entao o
// workflow do GitHub Actions imprime esta resposta no log da run.
export async function POST(request: NextRequest) {
  const segredo = request.headers.get('x-cron-secret')
  if (!segredo || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: pedidosCancelados, error } = await admin.rpc('cancelar_pedidos_expirados')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const resultados = await Promise.all(
    (pedidosCancelados ?? []).map((pedido) =>
      notificarPedido(pedido.tenant_id, pedido.id, 'pedido_cancelado', {
        motivo: 'Cancelamento automático — prazo de validação expirado',
      })
    )
  )

  const resumo = { email: { ok: 0, falha: 0 }, whatsapp: { ok: 0, falha: 0 } }
  for (const resultado of resultados) {
    for (const canal of resultado.canais) {
      const alvo = resumo[canal.canal]
      if (canal.enviado) alvo.ok += 1
      else alvo.falha += 1
    }
  }

  return NextResponse.json({
    data: {
      pedidosCancelados: resultados.length,
      notificacoes: resumo,
      detalhe: resultados,
    },
  })
}
