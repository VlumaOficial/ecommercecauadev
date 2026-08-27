import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { canalEmail } from './canal-email'
import { canalWhatsapp } from './canal-whatsapp'
import { buscarTemplate } from './templates'

// Melhoria de notificação (c), REGRAS_DE_NEGOCIO.md §18.6c — avisa a
// EQUIPE (staff configurados em order_notification_recipients, migration
// 044) quando um cliente finaliza um pedido no checkout.
//
// Pipeline SEPARADO do notificarPedido() do incremento 8 (que notifica o
// CLIENTE): destinatário diferente (staff), tabela diferente de onde vem
// o destinatário, evento próprio ('pedido_novo'). Reaproveita só as
// peças de baixo nível — canalEmail / canalWhatsapp / buscarTemplate
// (com o resolvedor de placeholders embutido).
//
// Best-effort de verdade: sempre via service role (leitura interna), e
// NUNCA lança — o checkout do cliente não pode falhar nem atrasar por
// causa da notificação ao lojista. Chamado via after() no Route Handler.

export type ResultadoEnvioLojista = {
  profileId: string
  canal: 'email' | 'whatsapp'
  destino: string
  enviado: boolean
  motivo?: string
}
export type ResultadoNotificacaoLojista = {
  orderId: string
  numero: number
  destinatarios: number
  envios: ResultadoEnvioLojista[]
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export async function notificarPedidoNovoParaLojista(
  tenantId: string,
  orderId: string
): Promise<ResultadoNotificacaoLojista> {
  const vazio: ResultadoNotificacaoLojista = { orderId, numero: 0, destinatarios: 0, envios: [] }

  try {
    const admin = createAdminClient()

    const { data: pedido } = await admin
      .from('orders')
      .select('numero, total, customer_id')
      .eq('id', orderId)
      .single()
    if (!pedido) {
      console.error(`[notificacoes] pedido ${orderId} nao encontrado ao avisar lojista de pedido novo`)
      return vazio
    }

    // Quem recebe: linhas ativas de order_notification_recipients do
    // tenant. Duas queries + join em JS em vez de embed do PostgREST — a
    // FK composta (onr_profile_mesmo_tenant) torna o embedding menos
    // previsível.
    const { data: recipients } = await admin
      .from('order_notification_recipients')
      .select('profile_id, canal_email, canal_whatsapp')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)

    if (!recipients || recipients.length === 0) {
      // Zero destinatários configurados é um caminho normal, não erro.
      return { ...vazio, numero: pedido.numero }
    }

    const [{ data: perfis }, { data: cliente }, { data: tenant }, { data: dominio }] = await Promise.all([
      admin.from('profiles').select('id, email, whatsapp, ativo').in('id', recipients.map((r) => r.profile_id)),
      admin.from('customers').select('nome').eq('id', pedido.customer_id).single(),
      admin.from('tenants').select('nome').eq('id', tenantId).single(),
      admin.from('tenant_domains').select('dominio').eq('tenant_id', tenantId).limit(1).maybeSingle(),
    ])

    // Só profiles ATIVOS entram (uma linha de recipient pode ter ficado
    // pra trás de um staff desativado depois).
    const perfilPorId = new Map((perfis ?? []).filter((p) => p.ativo).map((p) => [p.id, p]))

    const totalNum = Number(pedido.total)
    const vars: Record<string, string> = {
      numero_pedido: String(pedido.numero),
      nome_cliente: cliente?.nome ?? '',
      valor_total: Number.isFinite(totalNum) ? brl.format(totalNum) : String(pedido.total ?? ''),
      nome_loja: tenant?.nome ?? '',
      // Link pro PAINEL do vendedor (por id), NUNCA a área do cliente.
      link_painel_pedido: dominio ? `https://${dominio.dominio}/painel/pedidos/${orderId}` : '',
    }

    const [templateEmail, templateWhatsapp] = await Promise.all([
      buscarTemplate(tenantId, 'pedido_novo', 'email', vars),
      buscarTemplate(tenantId, 'pedido_novo', 'whatsapp', vars),
    ])

    const tarefas: Promise<ResultadoEnvioLojista>[] = []
    let destinatarios = 0
    for (const r of recipients) {
      const p = perfilPorId.get(r.profile_id)
      if (!p) continue
      destinatarios++

      // Envia só pelo canal marcado E com o dado disponível E com template.
      if (r.canal_email && p.email && templateEmail) {
        tarefas.push(
          canalEmail
            .send({ destinatario: p.email, assunto: templateEmail.assunto ?? undefined, corpo: templateEmail.corpo })
            .then((res) => ({ profileId: p.id, canal: 'email' as const, destino: p.email, enviado: res.ok, motivo: res.erro }))
        )
      }
      if (r.canal_whatsapp && p.whatsapp && templateWhatsapp) {
        const numero = p.whatsapp
        tarefas.push(
          canalWhatsapp
            .send({ destinatario: numero, corpo: templateWhatsapp.corpo })
            .then((res) => ({ profileId: p.id, canal: 'whatsapp' as const, destino: numero, enviado: res.ok, motivo: res.erro }))
        )
      }
    }

    const liquidados = await Promise.allSettled(tarefas)
    const envios: ResultadoEnvioLojista[] = liquidados.map((x) =>
      x.status === 'fulfilled'
        ? x.value
        : { profileId: '?', canal: 'email', destino: '?', enviado: false, motivo: String(x.reason) }
    )
    for (const e of envios) {
      if (!e.enviado) {
        console.error(
          `[notificacoes] falha ao avisar lojista (pedido ${pedido.numero}, ${e.canal} -> ${e.destino}):`,
          e.motivo
        )
      }
    }

    return { orderId, numero: pedido.numero, destinatarios, envios }
  } catch (e) {
    // Nunca propaga — best-effort. O after() no checkout também tem um
    // .catch(), isto é a segunda rede.
    console.error('[notificacoes] erro inesperado ao avisar lojista de pedido novo:', e)
    return vazio
  }
}
