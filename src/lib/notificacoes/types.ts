// Incremento 8 (Notificações, Fase 2) - interface canal-agnóstica:
// quem dispara uma notificação (notificar-pedido.ts) não conhece
// Zoho nem Evolution API, só fala com isto. Troca de provedor futura
// (ex.: ZeptoMail no lugar do Zoho SMTP, REGRAS_DE_NEGOCIO.md §18.5)
// vira só uma implementação nova desta interface, sem tocar quem chama.
export type NotificationChannel = {
  send(params: { destinatario: string; assunto?: string; corpo: string }): Promise<{ ok: boolean; erro?: string }>
}

// 'pedido_novo' (melhoria (c), REGRAS_DE_NEGOCIO.md §18.6c) é o único
// evento cujo destinatário é a EQUIPE (staff), não o cliente — disparado
// por src/lib/notificacoes/notificar-lojista.ts, nunca por notificar-pedido.ts.
// Todos os demais têm o CLIENTE como destinatário (notificar-pedido.ts).
// 'pedido_recebido' (melhoria (b), §18.6b) — incremento 1 de 4 da frente
// de notificações ao cliente; disparado no checkout após criar_pedido.
export type EventoNotificacao =
  | 'pedido_recebido'
  | 'pedido_validado'
  | 'pedido_ajustado'
  | 'pedido_entregue'
  | 'pedido_cancelado'
  | 'pedido_novo'
export type CanalNotificacao = 'email' | 'whatsapp'
