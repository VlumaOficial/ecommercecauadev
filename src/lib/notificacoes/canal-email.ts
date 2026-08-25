import 'server-only'
import nodemailer from 'nodemailer'
import type { NotificationChannel } from './types'

// Zoho SMTP e' a primeira implementacao concreta - nomes de env var
// genericos (EMAIL_SMTP_*, nao ZOHO_*) de proposito, pra uma troca
// futura de provedor SMTP nao exigir renomear nada. Debito conhecido
// registrado com o PO (25/08/2026): Zoho Mail SMTP tem limite diario
// baixo pra volume transacional - ZeptoMail (mesmo grupo, API
// propria) e' o proximo passo natural quando o volume justificar,
// como uma segunda implementacao desta mesma interface
// (REGRAS_DE_NEGOCIO.md §18.5).
function transportador() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
    secure: process.env.EMAIL_SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASSWORD,
    },
  })
}

export const canalEmail: NotificationChannel = {
  async send({ destinatario, assunto, corpo }) {
    try {
      await transportador().sendMail({
        from: `"${process.env.EMAIL_FROM_NAME ?? ''}" <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: destinatario,
        subject: assunto ?? '',
        text: corpo,
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : 'Erro desconhecido ao enviar e-mail.' }
    }
  },
}
