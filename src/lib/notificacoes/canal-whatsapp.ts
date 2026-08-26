import 'server-only'
import type { NotificationChannel } from './types'

// customers.whatsapp e' gravado so' com DDD+numero (10-11 digitos,
// sem DDI - ver src/app/(auth)/cadastro/cadastro-form.tsx), mas a
// Evolution API espera o numero completo (DDI+DDD+numero). Prefixa
// 55 (Brasil) quando o numero ainda nao tem DDI - unica premissa
// deste incremento, a confirmar/ajustar no primeiro envio real
// contra a instancia (https://evo.vluma.com.br).
function numeroComDDI(whatsapp: string): string {
  const digitos = whatsapp.replace(/\D/g, '')
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

export const canalWhatsapp: NotificationChannel = {
  async send({ destinatario, corpo }) {
    const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EVOLUTION_API_KEY ?? '',
        },
        body: JSON.stringify({ number: numeroComDDI(destinatario), text: corpo }),
      })
      const corpoResposta = await response.text().catch(() => '')
      if (!response.ok) {
        return { ok: false, erro: `Evolution API respondeu ${response.status}: ${corpoResposta.slice(0, 200)}` }
      }
      // Sucesso tambem loga o corpo da resposta (id/status da mensagem)
      // - antes so' o erro era logado, o que impedia diagnosticar o
      // envio mesmo quando deu certo (achado ao verificar o formato
      // do numero com o PO, 26/08/2026).
      console.log(`[notificacoes] Evolution API respondeu ${response.status}:`, corpoResposta.slice(0, 500))
      return { ok: true }
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : 'Erro desconhecido ao enviar WhatsApp.' }
    }
  },
}
