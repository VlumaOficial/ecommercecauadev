import { z } from 'zod'

// WhatsApp OPCIONAL (ex.: staff sem número só recebe notificação por
// e-mail). Normaliza pra só dígitos (DDD + número, sem DDI) — MESMA
// convenção de customers.whatsapp, pra src/lib/notificacoes/canal-whatsapp.ts
// (numeroComDDI) reaproveitar sem mudança. Vazio/ausente vira null.
export const whatsappOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ?? '').replace(/\D/g, ''))
  .refine(
    (v) => v === '' || v.length === 10 || v.length === 11,
    'Informe um WhatsApp válido com DDD (10 ou 11 dígitos) ou deixe em branco.'
  )
  .transform((v) => (v === '' ? null : v))
