import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getTenantFromHeaders } from '@/lib/tenant'
import { getPublicDeliveryCities } from '@/lib/loja/rpc'
import { getCustomerProfile } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { CheckoutWizard } from '@/components/loja/checkout/checkout-wizard'

export const dynamic = 'force-dynamic'

// Fase 2, incremento 5 (Checkout). Gate de sessao: so cliente logado
// finaliza pedido - decisao aprovada com o PO (Opcao A, REGRAS_DE_NEGOCIO.md
// §15.2) - a RPC criar_pedido (migration 037) ja exige isso (customer_id
// resolvido de auth.uid(), NOT NULL). Convidado fica registrado como
// pendencia de fase futura (ver ESCOPO_PROJETO.md §0), com escopo proprio
// ainda a desenhar (verificacao de identidade sem conta + como o convidado
// recupera o pedido depois).
export default async function CheckoutPage() {
  const tenant = await getTenantFromHeaders()
  if (!tenant) notFound()

  const cliente = await getCustomerProfile()

  // Carrinho continua intacto (client-side, independe de sessao -
  // REGRAS_DE_NEGOCIO.md §11.1) - o ?proximo=/checkout leva o cliente de
  // volta pra ca depois de entrar ou confirmar o cadastro.
  if (!cliente) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)]">
          <h1 className="font-display text-xl font-bold text-primary mb-2">Entre para finalizar seu pedido</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Seu carrinho continua salvo. Entre ou crie sua conta para continuar.
          </p>
          <div className="flex flex-col gap-3">
            {/* <a> (não <Link>): navegação de documento pra /entrar — ignora o
                Router Cache do cliente (item 50). */}
            <Button className="h-11 w-full text-base" render={<a href="/entrar?proximo=/checkout" />}>
              Entrar
            </Button>
            <Link href="/cadastro?proximo=/checkout">
              <Button variant="outline" className="h-11 w-full text-base">Criar conta</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const cidades = await getPublicDeliveryCities(tenant.slug)

  return <CheckoutWizard cliente={cliente} cidades={cidades} />
}
