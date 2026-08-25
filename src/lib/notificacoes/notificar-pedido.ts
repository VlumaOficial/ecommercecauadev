import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { canalEmail } from './canal-email'
import { canalWhatsapp } from './canal-whatsapp'
import { buscarTemplate } from './templates'
import type { EventoNotificacao, CanalNotificacao } from './types'

export type ResultadoEnvioCanal = { canal: CanalNotificacao; enviado: boolean; motivo?: string }
export type ResultadoNotificacao = {
  orderId: string
  numero: number
  canais: ResultadoEnvioCanal[]
}

// Orquestrador central: busca pedido+cliente+loja+dominio+templates
// e dispara os canais em paralelo (Promise.allSettled implicito via
// try/catch em cada canal - falha de um nunca bloqueia o outro).
// Sempre via service role - leitura interna do sistema, a
// autorizacao de quem PODE disparar isto ja aconteceu antes, no
// Route Handler que chama esta funcao (sessao de staff ou
// CRON_SECRET). Nunca lanca excecao - best-effort, a acao principal
// do vendedor (validar/ajustar/cancelar) nunca deve falhar por causa
// de notificacao.
export async function notificarPedido(
  tenantId: string,
  orderId: string,
  evento: EventoNotificacao,
  extra?: { motivo?: string }
): Promise<ResultadoNotificacao> {
  const admin = createAdminClient()

  const { data: pedido } = await admin.from('orders').select('id, numero, customer_id').eq('id', orderId).single()
  if (!pedido) {
    console.error(`[notificacoes] pedido ${orderId} nao encontrado ao notificar evento ${evento}`)
    return { orderId, numero: 0, canais: [] }
  }

  const [{ data: cliente }, { data: tenant }, { data: dominio }] = await Promise.all([
    admin.from('customers').select('nome, email, whatsapp').eq('id', pedido.customer_id).single(),
    admin.from('tenants').select('nome').eq('id', tenantId).single(),
    admin.from('tenant_domains').select('dominio').eq('tenant_id', tenantId).limit(1).maybeSingle(),
  ])

  if (!cliente) {
    console.error(`[notificacoes] cliente do pedido ${pedido.numero} nao encontrado ao notificar evento ${evento}`)
    return { orderId, numero: pedido.numero, canais: [] }
  }

  const vars: Record<string, string> = {
    nome_cliente: cliente.nome,
    numero_pedido: String(pedido.numero),
    nome_loja: tenant?.nome ?? '',
    link_pedido: dominio ? `https://${dominio.dominio}/meus-pedidos/${pedido.numero}` : '',
    motivo: extra?.motivo ?? '',
  }

  const canais: ResultadoEnvioCanal[] = []

  if (cliente.email) {
    const template = await buscarTemplate(tenantId, evento, 'email', vars)
    if (template) {
      const resultado = await canalEmail.send({
        destinatario: cliente.email,
        assunto: template.assunto ?? undefined,
        corpo: template.corpo,
      })
      canais.push({ canal: 'email', enviado: resultado.ok, motivo: resultado.erro })
      if (!resultado.ok) {
        console.error(`[notificacoes] falha ao enviar e-mail (pedido ${pedido.numero}, evento ${evento}):`, resultado.erro)
      }
    }
  }

  const templateWhatsapp = await buscarTemplate(tenantId, evento, 'whatsapp', vars)
  if (templateWhatsapp) {
    const resultado = await canalWhatsapp.send({ destinatario: cliente.whatsapp, corpo: templateWhatsapp.corpo })
    canais.push({ canal: 'whatsapp', enviado: resultado.ok, motivo: resultado.erro })
    if (!resultado.ok) {
      console.error(`[notificacoes] falha ao enviar whatsapp (pedido ${pedido.numero}, evento ${evento}):`, resultado.erro)
    }
  }

  return { orderId, numero: pedido.numero, canais }
}
