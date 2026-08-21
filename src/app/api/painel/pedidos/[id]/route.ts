import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'

// Detalhe/validacao (REGRAS_DE_NEGOCIO.md §20). Join com
// product_variants traz saldo_estoque ATUAL (nao um snapshot do
// pedido) - e' o que o vendedor precisa ver pra decidir se
// valida/reduz cada item, sem precisar de RPC nova (o join resolve
// isso direto, como o desenho ja previa). RLS (orders_select_staff/
// order_items_select_staff, migration 037) escopa por tenant sozinha -
// sem filtro explicito extra aqui, mesmo padrao do resto do painel.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  const podeGerenciar = perfil.role === 'admin' || perfil.pode_aceitar_pedido

  const { data: pedido, error } = await supabase
    .from('orders')
    .select(
      'id, numero, status, modalidade_entrega, data_prevista, data_efetiva, observacao_cliente, observacao_interna, motivo_cancelamento, total, created_at, customers(nome, whatsapp, email), delivery_cities(nome, uf, ponto_entrega, horario)'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  }

  const { data: itensBrutos, error: errItens } = await supabase
    .from('order_items')
    .select(
      'variant_id, product_id, quantidade, preco_unitario, subtotal, products(nome), product_variants(nome, sku, saldo_estoque)'
    )
    .eq('order_id', id)

  if (errItens) {
    return NextResponse.json({ error: 'Não foi possível carregar os itens do pedido.' }, { status: 400 })
  }

  const itens = (itensBrutos ?? []).map((item) => ({
    variant_id: item.variant_id,
    product_id: item.product_id,
    produto_nome: item.products?.nome ?? '—',
    variacao_nome: item.product_variants?.nome ?? '',
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    subtotal: item.subtotal,
    saldo_estoque: item.product_variants?.saldo_estoque ?? 0,
  }))

  return NextResponse.json({
    data: {
      id: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      modalidade_entrega: pedido.modalidade_entrega,
      data_prevista: pedido.data_prevista,
      data_efetiva: pedido.data_efetiva,
      observacao_cliente: pedido.observacao_cliente,
      // observacao_interna so' vai pra tela quando pode_gerenciar -
      // nao ha necessidade de negocio pra staff sem permissao ver
      // anotacao interna que nem consegue agir em cima (defesa em
      // profundidade, alem do RLS ja restringir a tenant/staff).
      observacao_interna: podeGerenciar ? pedido.observacao_interna : null,
      motivo_cancelamento: pedido.motivo_cancelamento,
      total: pedido.total,
      created_at: pedido.created_at,
      cliente: pedido.customers ?? { nome: '—', whatsapp: '', email: null },
      cidade: pedido.delivery_cities ?? null,
      itens,
      pode_gerenciar: podeGerenciar,
    },
  })
}
