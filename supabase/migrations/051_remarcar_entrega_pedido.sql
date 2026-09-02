-- =====================================================
-- Feature "modificação de pedido pelo vendedor" — Incremento (B):
-- RPC de remarcação da data de entrega.
--
-- Par das migrations 049 (tabela de histórico) e 050 (evento +
-- templates). NÃO dispara notificação (Postgres não chama HTTP neste
-- projeto) — quem chama (POST /api/painel/pedidos/[id]/remarcar-entrega)
-- faz o `after()` -> notificarPedido(..., 'pedido_data_remarcada')
-- depois desta RPC ter sucesso.
--
-- Mesmo molde de validar_pedido / cancelar_pedido / concluir_pedido
-- (migration 039) e atualizar_observacao_interna_pedido (040):
-- SECURITY DEFINER, checagem de permissão + tenant + status no corpo,
-- retorna a linha `public.orders` atualizada.
--
-- ⚠️ NÃO APLICADA — arquivo criado para revisão do PO. O PO aplica no
-- SQL Editor após aprovar o desenho.
--
-- Assinatura:
--   remarcar_entrega_pedido(
--     p_order_id  uuid,
--     p_data_nova date,   -- obrigatória (a ação sempre define uma data)
--     p_motivo    text    -- obrigatório, interno (rastreabilidade)
--   ) returns public.orders
--
-- Lógica:
--   1. staff_pode_gerenciar_pedidos() senão exceção.
--   2. trava o pedido (FOR UPDATE), confere tenant.
--   3. status ∈ {aguardando_validacao, confirmado} senão exceção.
--   4. motivo não-vazio senão exceção.
--   5. data_nova não-nula senão exceção.
--   6. data_nova tem que MUDAR a previsão (is distinct from a atual)
--      senão exceção — evita remarcação no-op / notificação à toa.
--   7. INSERT em order_delivery_reschedules (data_anterior = a
--      data_prevista atual do pedido, pode ser NULL; alterado_por =
--      auth.uid()).
--   8. UPDATE orders SET data_prevista = data_nova.
--   9. retorna a linha atualizada.
-- =====================================================

create or replace function public.remarcar_entrega_pedido(
  p_order_id uuid,
  p_data_nova date,
  p_motivo text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_order public.orders;
  v_motivo text;
begin
  if not public.staff_pode_gerenciar_pedidos() then
    raise exception 'Você não tem permissão para remarcar entregas.';
  end if;

  v_tenant_id := public.current_tenant_id();

  select * into v_order
  from public.orders
  where id = p_order_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_order.status not in ('aguardando_validacao', 'confirmado') then
    raise exception 'Só é possível remarcar a entrega de um pedido aguardando validação ou confirmado.';
  end if;

  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  if v_motivo is null then
    raise exception 'Informe o motivo da remarcação.';
  end if;

  if p_data_nova is null then
    raise exception 'Informe a nova data de entrega.';
  end if;

  -- tem que mudar de fato (is distinct from trata NULL corretamente:
  -- "sem previsão" -> uma data conta como mudança).
  if v_order.data_prevista is not distinct from p_data_nova then
    raise exception 'A nova data é igual à data de entrega já prevista.';
  end if;

  insert into public.order_delivery_reschedules
    (tenant_id, order_id, data_anterior, data_nova, motivo, alterado_por)
  values
    (v_tenant_id, p_order_id, v_order.data_prevista, p_data_nova, v_motivo, auth.uid());

  update public.orders
  set data_prevista = p_data_nova
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.remarcar_entrega_pedido(uuid, date, text) is
  'Remarca a data de entrega de um pedido (feature "modificação de pedido pelo vendedor", incremento B). Só de aguardando_validacao/confirmado. Grava uma linha em order_delivery_reschedules (com a data anterior como snapshot, pode ser NULL) e atualiza orders.data_prevista, na mesma transação. Motivo obrigatório e interno (rastreabilidade) — não vai pro cliente. Não dispara notificação (o Route Handler chamador faz isso via after()). Mesma permissão de validar/editar/cancelar/concluir (staff_pode_gerenciar_pedidos).';

grant execute on function public.remarcar_entrega_pedido(uuid, date, text) to authenticated;
