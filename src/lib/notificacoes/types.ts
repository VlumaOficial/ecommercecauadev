// Incremento 8 (Notificações, Fase 2) - interface canal-agnóstica:
// quem dispara uma notificação (notificar-pedido.ts) não conhece
// Zoho nem Evolution API, só fala com isto. Troca de provedor futura
// (ex.: ZeptoMail no lugar do Zoho SMTP, REGRAS_DE_NEGOCIO.md §18.5)
// vira só uma implementação nova desta interface, sem tocar quem chama.
export type NotificationChannel = {
  send(params: { destinatario: string; assunto?: string; corpo: string }): Promise<{ ok: boolean; erro?: string }>
}

export type EventoNotificacao = 'pedido_validado' | 'pedido_ajustado' | 'pedido_cancelado'
export type CanalNotificacao = 'email' | 'whatsapp'
