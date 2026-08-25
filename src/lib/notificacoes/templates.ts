import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EventoNotificacao, CanalNotificacao } from './types'

export type TemplateResolvido = { assunto: string | null; corpo: string }

// Placeholders sao so' {chave} - troca literal, sem lib de template.
// Suficiente pro conjunto fixo de variaveis desta fase (nome_cliente,
// numero_pedido, nome_loja, link_pedido, motivo); se o catalogo de
// eventos/variaveis crescer muito, revisitar.
function resolverPlaceholders(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (match, chave) => vars[chave] ?? match)
}

// Le direto do banco via service role (leitura interna do sistema,
// nunca exposta a anon/cliente) - RLS staff-select/admin-write
// (migration 043) existe pra uma futura tela de edicao no painel,
// nao pra este caminho de leitura.
export async function buscarTemplate(
  tenantId: string,
  evento: EventoNotificacao,
  canal: CanalNotificacao,
  vars: Record<string, string>
): Promise<TemplateResolvido | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('notification_templates')
    .select('assunto, corpo')
    .eq('tenant_id', tenantId)
    .eq('evento', evento)
    .eq('canal', canal)
    .eq('ativo', true)
    .maybeSingle()

  if (!data) return null
  return {
    assunto: data.assunto ? resolverPlaceholders(data.assunto, vars) : null,
    corpo: resolverPlaceholders(data.corpo, vars),
  }
}
