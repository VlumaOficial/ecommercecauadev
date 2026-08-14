import { MessageCircleIcon } from 'lucide-react'

// Etapa 3 (migration 030): so aparece quando o lojista configurou um
// numero (whatsapp_numero null = comportamento de hoje, sem botao
// nenhum - a vitrine nao tem isso ainda, entao nao aparecer e' o
// "sem mudar de aparencia" correto aqui).
export function WhatsAppFloatButton({ numero, mensagem }: { numero: string | null; mensagem: string }) {
  if (!numero) return null

  const href = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <MessageCircleIcon className="size-7" />
    </a>
  )
}
