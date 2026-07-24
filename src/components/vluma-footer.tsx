import Image from 'next/image'

const ICONE =
  'https://embgxkrfwtbqfkwmquvo.supabase.co/storage/v1/object/public/assets/vluma-icone.png'
const NOME =
  'https://embgxkrfwtbqfkwmquvo.supabase.co/storage/v1/object/public/assets/vluma-nome.png'

export function VlumaFooter({ dark = false }: { dark?: boolean }) {
  return (
    <a
      href="https://www.vluma.com.br"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
    >
      <span className={dark ? 'text-slate-400 text-xs' : 'text-muted-foreground text-xs'}>
        Desenvolvido por
      </span>
      <Image src={ICONE} alt="" width={20} height={20} className="rounded-full" />
      <Image src={NOME} alt="VLUMA" width={72} height={16} className="h-4 w-auto" />
    </a>
  )
}
