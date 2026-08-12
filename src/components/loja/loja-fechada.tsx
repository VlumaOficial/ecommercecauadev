import { StoreIcon } from 'lucide-react'

export function LojaFechada({ nomeLoja, mensagem }: { nomeLoja: string; mensagem: string | null }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-secondary text-primary">
        <StoreIcon className="size-8" />
      </div>
      <h1 className="font-display text-2xl font-extrabold text-primary">{nomeLoja}</h1>
      <p className="max-w-md text-muted-foreground">
        {mensagem ?? 'Estamos fora do período de vendas no momento. Volte em breve.'}
      </p>
    </div>
  )
}
