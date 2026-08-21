-- =====================================================
-- Fase 2, incremento 7 (Painel de Pedidos) — parte 3, tela.
-- Achado ao implementar a UI: a migration 039 trouxe a permissão
-- (staff_pode_gerenciar_pedidos) e as 4 ações de destino do pedido
-- (validar/editar/cancelar/concluir), mas nenhuma delas escreve em
-- `orders.observacao_interna` — a coluna existe desde a 037, só de
-- LEITURA pro staff (RLS `orders_select_staff`), sem nenhuma policy
-- de UPDATE/RPC. A tela de validação (REGRAS_DE_NEGOCIO.md §20) pede
-- explicitamente "campo de observação interna (o vendedor edita)" —
-- faltava essa RPC. Escopo mínimo, isolado: só grava esse UM campo,
-- nada mais do pedido.
--
-- Mesma permissão das outras 4 ações (staff_pode_gerenciar_pedidos,
-- migration 039) — quem decide o destino do pedido também pode
-- anotar sobre ele. Sem restrição de status: o vendedor pode querer
-- anotar algo mesmo num pedido já confirmado/concluído/cancelado
-- (ex.: "cliente pediu pra entregar depois das 18h", "ligou
-- perguntando do atraso") — diferente de ajustar_itens_pedido, que é
-- restrito a aguardando_validacao por mexer no compromisso do pedido
-- em si, isto aqui é só anotação interna, sem efeito em itens/total/
-- estoque.
-- =====================================================

create or replace function public.atualizar_observacao_interna_pedido(
  p_order_id uuid,
  p_observacao text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_order public.orders;
begin
  if not public.staff_pode_gerenciar_pedidos() then
    raise exception 'Você não tem permissão para editar pedidos.';
  end if;

  v_tenant_id := public.current_tenant_id();

  update public.orders
  set observacao_interna = nullif(btrim(coalesce(p_observacao, '')), '')
  where id = p_order_id and tenant_id = v_tenant_id
  returning * into v_order;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  return v_order;
end;
$$;

comment on function public.atualizar_observacao_interna_pedido(uuid, text) is
  'Grava a anotação interna do vendedor sobre o pedido (REGRAS_DE_NEGOCIO.md §19.3/§20) - o cliente nunca vê este campo. Mesma permissão de validar/editar/cancelar/concluir (staff_pode_gerenciar_pedidos, migration 039). Sem restrição de status, de propósito - é só anotação, não mexe em itens/total/estoque.';

grant execute on function public.atualizar_observacao_interna_pedido(uuid, text) to authenticated;
