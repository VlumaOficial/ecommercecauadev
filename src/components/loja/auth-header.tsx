import Image from 'next/image'
import Link from 'next/link'

import { urlLogoLoja } from '@/lib/loja/rpc'

// Header minimalista pras 4 telas de auth ((auth)/**) - logo + nome,
// sem nav/busca/carrinho (nao fazem sentido fora do fluxo da vitrine).
// nomeLoja null quando o tenant nao resolveu (host sem match em
// tenant_domains) - so mostra a logo padrao nesse caso, login/cadastro
// continuam funcionando mesmo sem branding de tenant nenhum.
export function AuthHeader({ nomeLoja, logoPath }: { nomeLoja: string | null; logoPath: string | null }) {
  return (
    <Link href="/" className="flex flex-col items-center gap-2">
      <Image src={urlLogoLoja(logoPath)} alt="" width={56} height={45} className="h-12 w-auto" priority />
      {nomeLoja && (
        <span className="font-display text-lg font-extrabold tracking-tight text-primary">{nomeLoja}</span>
      )}
    </Link>
  )
}
