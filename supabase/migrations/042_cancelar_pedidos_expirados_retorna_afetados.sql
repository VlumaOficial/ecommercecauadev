-- =====================================================
-- Fase 2, incremento 8 (Notificações) — fecha o gap de arquitetura
-- registrado ao desenhar o incremento: cancelar_pedidos_expirados()
-- (migration 039) roda sem sessão, via GitHub Action cron, e só
-- devolvia a QUANTIDADE de pedidos cancelados — sem saber QUAIS,
-- não havia como notificar o cliente de cada um (REGRAS_DE_NEGOCIO.md
-- §18.1: cancelamento automático também precisa avisar o cliente).
--
-- Muda o retorno de `integer` (contagem) para uma tabela com os
-- pedidos afetados (id, tenant_id, customer_id, numero) — o mínimo
-- necessário pra quem chama buscar cliente/template e notificar.
-- `RETURNS TABLE` não aceita `create or replace` quando muda o
-- shape de retorno de uma função já existente (mesma lição das
-- migrations 029/030) — precisa de `drop` antes.
--
-- DECISÃO DE SEGURANÇA (revisão do próprio desenho, antes de
-- escrever o SQL): a versão antiga era `grant ... to anon,
-- authenticated` porque só devolvia um número - inofensivo. A nova
-- versão devolve customer_id/numero por pedido, então NÃO pode
-- continuar aberta a anon/authenticated (viraria enumeração de
-- pedidos/clientes de qualquer tenant pra quem tiver a anon key,
-- que é pública por design - mesma classe de vazamento já corrigida
-- nas migrations 013/014/018 desta árvore). Revogado de
-- anon/authenticated, concedido só a service_role - mesmo padrão
-- estrutural já usado em promover_para_staff (migration 041). A
-- GitHub Action para de chamar esta RPC direto via REST com a anon
-- key (não vai mais funcionar, de propósito) e passa a chamar uma
-- rota nova do Next.js (`POST /api/cron/notificar-cancelamentos`,
-- protegida por um segredo compartilhado `CRON_SECRET`) que usa o
-- client de service role internamente.
-- =====================================================

drop function if exists public.cancelar_pedidos_expirados();

create function public.cancelar_pedidos_expirados()
returns table (
  id uuid,
  tenant_id uuid,
  customer_id uuid,
  numero integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.orders o
  set status = 'cancelado',
      motivo_cancelamento = 'Cancelamento automático — prazo de validação expirado'
  from public.store_settings s
  where o.tenant_id = s.tenant_id
    and o.status = 'aguardando_validacao'
    and s.cancelamento_automatico_habilitado = true
    and o.created_at < now() - (s.prazo_cancelamento_automatico_horas || ' hours')::interval
  returning o.id, o.tenant_id, o.customer_id, o.numero;
end;
$$;

comment on function public.cancelar_pedidos_expirados() is
  'Roda SEM sessão de usuário, só service_role (rota /api/cron/notificar-cancelamentos, protegida por CRON_SECRET). Escopo 100% pelas condições do WHERE (status/prazo/flag POR TENANT), nunca por auth.uid()/is_staff() - mesma lógica da versão anterior (migration 039), só o retorno mudou. Idempotente e autolimitada. Nunca mexe em estoque (aguardando_validacao nunca reservou nada). Retorna os pedidos afetados (não só a contagem) pra quem chama poder notificar cada cliente - por isso NÃO é mais chamável por anon/authenticated (exporia customer_id/numero de pedidos de qualquer tenant pra quem tiver a anon key), só por service_role.';

revoke all on function public.cancelar_pedidos_expirados() from public, anon, authenticated;
grant execute on function public.cancelar_pedidos_expirados() to service_role;
