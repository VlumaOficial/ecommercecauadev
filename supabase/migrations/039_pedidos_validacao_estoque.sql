-- =====================================================
-- Fase 2, incremento 7 do roteiro: Painel de Pedidos do vendedor
-- (validar/editar/cancelar/concluir) + cancelamento automático por
-- prazo. Fecha o ciclo de venda (cliente compra -> vê -> vendedor
-- valida) e é aqui que a baixa de estoque REAL finalmente acontece
-- (REGRAS_DE_NEGOCIO.md §16.4 — o pedido nasceu como solicitação sem
-- tocar estoque na migration 037, de propósito).
--
-- Decisões aprovadas com o PO em 21/08/2026, ANTES desta migration:
--   1. As RPCs de validar/cancelar chamam registrar_movimentacao_estoque()
--      (migration 021) por dentro, em vez de reimplementar a
--      atomicidade (FOR UPDATE, não-negativo, ledger imutável) que já
--      existe e já está em produção. SECURITY DEFINER muda privilégio
--      de execução, não identidade — auth.uid()/is_staff() dentro da
--      função chamada continuam resolvendo pra quem chamou a função de
--      fora, então isso funciona sem gambiarra nenhuma.
--   2. Estoque insuficiente ao validar = tudo ou nada (Opção A). Se
--      qualquer item não tiver saldo, a transação inteira do
--      validar_pedido desfaz (nenhum item é baixado) — reaproveita a
--      garantia de saldo não-negativo que registrar_movimentacao_estoque
--      já impõe, sem precisar de exceção nova. O vendedor usa
--      ajustar_itens_pedido (Editar) pra reduzir/remover o item
--      problemático e tenta validar de novo.
--   3. Cancelamento automático via GitHub Action cron (mesmo padrão já
--      em produção do keepalive_ping, .github/workflows/keepalive.yml),
--      chamando cancelar_pedidos_expirados() com a anon key, SEM
--      sessão nenhuma. CUIDADO (explicitamente pedido pelo PO): essa
--      RPC não pode depender de auth.uid()/is_staff() pra escopo — o
--      escopo tem que vir 100% das condições estritas do próprio SQL
--      (status='aguardando_validacao' E mais velho que o prazo
--      configurado E cancelamento_automatico_habilitado=true, POR
--      TENANT, nunca um critério mais largo). Implementada como um
--      único UPDATE...FROM com WHERE explícito — sem loop, sem cursor,
--      sem branch de aplicação decidindo o escopo.
--   4. "Cancelar" exige a MESMA permissão que "Validar"
--      (pode_aceitar_pedido) — regra única: quem decide o destino do
--      pedido decide pros dois casos. Junto com "Editar" e "Concluir"
--      (mesma lógica: todas as 4 RPCs que mexem no destino de um
--      pedido específico usam o mesmo gate). cancelar_pedidos_expirados
--      é a ÚNICA exceção, de propósito (roda sem sessão, ver item 3).
--
-- Prazo automático default TRUE (diferente do default FALSE de
-- valor_minimo_pedido_habilitado) — decisão consciente do PO: uma
-- solicitação nunca validada precisa expirar, senão fica pendente pra
-- sempre; aqui o comportamento seguro por padrão é ESTAR LIGADO.
-- =====================================================

-- ---------- 1. store_settings: política de cancelamento automático ----------
alter table public.store_settings
  add column if not exists cancelamento_automatico_habilitado boolean not null default true,
  add column if not exists prazo_cancelamento_automatico_horas integer not null default 48;

alter table public.store_settings
  drop constraint if exists chk_store_settings_prazo_cancelamento_positivo;
alter table public.store_settings
  add constraint chk_store_settings_prazo_cancelamento_positivo
  check (prazo_cancelamento_automatico_horas > 0);

comment on column public.store_settings.cancelamento_automatico_habilitado is
  'Se true, pedidos aguardando_validacao mais velhos que prazo_cancelamento_automatico_horas são cancelados sozinhos (cancelar_pedidos_expirados, via cron). Default true (REGRAS_DE_NEGOCIO.md §17.2) - diferente de outras flags do sistema, aqui o padrão seguro é ligado.';
comment on column public.store_settings.prazo_cancelamento_automatico_horas is
  'Prazo em horas pra um pedido aguardando_validacao ser cancelado automaticamente. Configurável pelo lojista, nunca fixo no código.';

-- Campos NÃO expostos em get_public_store_settings de propósito - são
-- configuração operacional interna do staff, a vitrine pública não
-- precisa (diferente de valor_minimo_pedido, que o cliente precisa ver).

-- ---------- 2. orders: motivo do cancelamento ----------
alter table public.orders
  add column if not exists motivo_cancelamento text;

comment on column public.orders.motivo_cancelamento is
  'Preenchido só quando status=cancelado. Manual: texto que o vendedor digitou (cancelar_pedido). Automático: mensagem fixa gerada por cancelar_pedidos_expirados.';

-- ---------- 3. Helper: quem pode gerenciar pedidos (validar/editar/cancelar/concluir) ----------
-- Mesmo padrão de is_staff()/is_admin() (migration 002). Admin sempre
-- pode (REGRAS_DE_NEGOCIO.md §1, "acesso total"); operador só se
-- pode_aceitar_pedido=true (permissão individual, não automática por
-- ser operador). Usada pelas 4 RPCs que mexem no destino de UM pedido
-- específico - cancelar_pedidos_expirados (sistema, sem sessão) NUNCA
-- chama esta função.
create or replace function public.staff_pode_gerenciar_pedidos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and ativo = true
      and (role = 'admin' or pode_aceitar_pedido = true)
  );
$$;

comment on function public.staff_pode_gerenciar_pedidos() is
  'true se o staff logado pode validar/editar/cancelar/concluir pedidos - admin sempre, operador só com pode_aceitar_pedido=true (REGRAS_DE_NEGOCIO.md §1). Decisão do PO em 21/08/2026: mesma permissão pras 4 ações, regra única.';

-- ---------- 4. RPC: ajustar_itens_pedido ("Editar", §15.4) ----------
-- Só reduz/remove itens de um pedido AINDA NÃO validado - nunca
-- aumenta quantidade nem adiciona item novo (checado explicitamente
-- abaixo, não é só uma convenção da UI). Não toca estoque: o pedido
-- em aguardando_validacao nunca reservou nada (§16.4), então reduzir
-- aqui não tem nada pra "devolver".
create or replace function public.ajustar_itens_pedido(
  p_order_id uuid,
  p_itens jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_order public.orders;
  v_item jsonb;
  v_variant_id uuid;
  v_quantidade integer;
  v_item_atual public.order_items;
  v_ids_mantidos uuid[] := '{}';
  v_total numeric(12,2) := 0;
  v_subtotal numeric(12,2);
begin
  if not public.staff_pode_gerenciar_pedidos() then
    raise exception 'Você não tem permissão para editar pedidos.';
  end if;

  v_tenant_id := public.current_tenant_id();

  select * into v_order
  from public.orders
  where id = p_order_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_order.status <> 'aguardando_validacao' then
    raise exception 'Este pedido não pode mais ser editado.';
  end if;

  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Não é possível remover todos os itens — cancele o pedido em vez disso.';
  end if;

  -- Passo 1: valida e reduz cada item informado. Cada variant_id
  -- precisa já existir no pedido (nunca "adicionar") e a nova
  -- quantidade nunca pode ser maior que a atual (nunca "aumentar").
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    begin
      v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
      v_quantidade := nullif(v_item->>'quantidade', '')::integer;
    exception when others then
      raise exception 'Item do pedido inválido.';
    end;

    if v_variant_id is null or v_quantidade is null or v_quantidade <= 0 then
      raise exception 'Item do pedido inválido.';
    end if;

    select * into v_item_atual
    from public.order_items
    where order_id = p_order_id and variant_id = v_variant_id;

    if not found then
      raise exception 'Só é possível reduzir itens que já estão no pedido — nenhum item novo pode ser adicionado ao editar.';
    end if;

    if v_quantidade > v_item_atual.quantidade then
      raise exception 'Não é possível aumentar a quantidade de um item ao editar — só reduzir ou remover.';
    end if;

    v_subtotal := v_item_atual.preco_unitario * v_quantidade;

    update public.order_items
    set quantidade = v_quantidade, subtotal = v_subtotal
    where id = v_item_atual.id;

    v_total := v_total + v_subtotal;
    v_ids_mantidos := array_append(v_ids_mantidos, v_variant_id);
  end loop;

  -- Passo 2: qualquer item do pedido original que não veio em p_itens
  -- foi removido de propósito.
  delete from public.order_items
  where order_id = p_order_id
    and variant_id <> all (v_ids_mantidos);

  update public.orders
  set total = v_total
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.ajustar_itens_pedido(uuid, jsonb) is
  'Editar pedido ao validar (REGRAS_DE_NEGOCIO.md §15.4) - só reduz/remove, nunca aumenta/adiciona. Só permitido com status=aguardando_validacao. Não mexe em estoque (pedido nunca reservou nada nesse status).';

grant execute on function public.ajustar_itens_pedido(uuid, jsonb) to authenticated;

-- ---------- 5. RPC: validar_pedido ----------
-- Baixa de estoque REAL acontece aqui (§16.4), item por item, via
-- registrar_movimentacao_estoque() (migration 021) - reaproveita a
-- atomicidade/FOR UPDATE/não-negativo já testados, não reimplementa.
--
-- Revisão de 21/08/2026 (achado do PO na revisão desta migration,
-- ANTES de aplicar): a primeira versão fazia a baixa direto e só
-- enriquecia o erro dentro de um EXCEPTION WHEN OTHERS - frágil por 3
-- motivos (fazer outro SELECT dentro do handler depois de um erro já
-- é arriscado; WHEN OTHERS captura mais do que só estoque
-- insuficiente; reconstruir a mensagem com SQLERRM perde o SQLSTATE
-- original). Reescrita em DUAS FASES na mesma transação:
--   FASE 1 (pré-validação): trava TODAS as variações do pedido de uma
--   vez (FOR UPDATE OF pv, em ordem estável por variant_id - evita
--   deadlock entre validações concorrentes que compartilham alguma
--   variação) e confere existência/modo_estoque/saldo de cada item,
--   com mensagem de erro já citando produto+variação. Nenhuma baixa
--   acontece aqui ainda.
--   FASE 2 (baixa de verdade): como as linhas continuam travadas pela
--   MESMA transação desde a fase 1 (lock do Postgres é por
--   transação, não por comando - uma trava já obtida nunca é perdida
--   nem precisa ser refeita), nada pode ter mudado o saldo entre as
--   duas fases. registrar_movimentacao_estoque() já não deveria mais
--   conseguir falhar por saldo insuficiente aqui - por isso a fase 2
--   é um loop simples, sem BEGIN/EXCEPTION nenhum: se algo ainda
--   assim desse errado, o erro original de registrar_movimentacao_estoque
--   propaga intacto (SQLSTATE preservado), não é reconstruído.
-- Tudo ou nada (Opção A) continua valendo, só que agora explícito na
-- fase 1, em vez de depender do rollback de uma exceção no meio da
-- baixa.
create or replace function public.validar_pedido(
  p_order_id uuid,
  p_data_prevista date default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_order public.orders;
  v_item record;
begin
  if not public.staff_pode_gerenciar_pedidos() then
    raise exception 'Você não tem permissão para validar pedidos.';
  end if;

  v_tenant_id := public.current_tenant_id();

  select * into v_order
  from public.orders
  where id = p_order_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_order.status <> 'aguardando_validacao' then
    raise exception 'Este pedido não está aguardando validação.';
  end if;

  -- FASE 1: trava e confere TODOS os itens antes de baixar qualquer
  -- um (tudo ou nada, decidido aqui, explicitamente - não como efeito
  -- colateral de uma exceção no meio do caminho).
  for v_item in
    select
      oi.variant_id,
      oi.quantidade,
      p.nome as produto_nome,
      pv.nome as variante_nome,
      pv.saldo_estoque,
      pv.modo_estoque
    from public.order_items oi
    join public.product_variants pv on pv.id = oi.variant_id
    join public.products p on p.id = pv.product_id
    where oi.order_id = p_order_id
    order by oi.variant_id
    for update of pv
  loop
    if v_item.modo_estoque <> 'quantitativo' then
      raise exception '% (%): esta variação não controla estoque por quantidade.',
        v_item.produto_nome, v_item.variante_nome;
    end if;

    if v_item.saldo_estoque < v_item.quantidade then
      raise exception '% (%): estoque insuficiente — disponível % unidade(s), pedido pede % unidade(s).',
        v_item.produto_nome, v_item.variante_nome, v_item.saldo_estoque, v_item.quantidade;
    end if;
  end loop;

  -- FASE 2: baixa de verdade - as travas da fase 1 garantem que nada
  -- mudou nesse meio-tempo, então isto não deveria mais conseguir
  -- falhar por saldo (ver nota acima). Ordem estável mantida, mesmo
  -- já não sendo estritamente necessária aqui (as linhas já estão
  -- travadas desde a fase 1), por clareza/consistência.
  for v_item in
    select variant_id, quantidade
    from public.order_items
    where order_id = p_order_id
    order by variant_id
  loop
    perform public.registrar_movimentacao_estoque(
      p_variant_id => v_item.variant_id,
      p_tipo => 'saida',
      p_quantidade => -v_item.quantidade,
      p_motivo => 'Baixa na validação do pedido #' || v_order.numero,
      p_referencia_tipo => 'pedido',
      p_referencia_id => p_order_id
    );
  end loop;

  update public.orders
  set status = 'confirmado', data_prevista = p_data_prevista
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.validar_pedido(uuid, date) is
  'Valida o pedido (aguardando_validacao -> confirmado) e baixa o estoque de verdade (REGRAS_DE_NEGOCIO.md §16.4). Duas fases na mesma transação: pré-valida existência/modo/saldo de TODOS os itens travando as variações (FOR UPDATE OF pv, ordem estável por variant_id), só então baixa de verdade item por item via registrar_movimentacao_estoque (migration 021) - reaproveita a atomicidade já testada, não reimplementa. Tudo ou nada (Opção A, decisão do PO em 21/08/2026): falta de estoque em qualquer item é recusada já na fase 1, com o nome do produto/variação na mensagem - use ajustar_itens_pedido pra reduzir/remover o item problemático e valide de novo. Revisado em 21/08/2026 (achado na revisão desta migration): a versão anterior enriquecia erro via EXCEPTION WHEN OTHERS + SELECT dentro do handler - frágil (mascarava erro se o SELECT falhasse, capturava mais que só estoque insuficiente, perdia o SQLSTATE original ao reconstruir com SQLERRM). A versão em duas fases elimina a necessidade de qualquer EXCEPTION handler na baixa real.';

grant execute on function public.validar_pedido(uuid, date) to authenticated;

-- ---------- 6. RPC: cancelar_pedido (manual, §17.1) ----------
-- Cancelável a partir de aguardando_validacao OU confirmado (nunca de
-- concluido, que já é terminal). Só devolve estoque se o pedido já
-- tinha sido validado (confirmado) - aguardando_validacao nunca
-- reservou nada, não tem o que devolver.
create or replace function public.cancelar_pedido(
  p_order_id uuid,
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
  v_item record;
begin
  if not public.staff_pode_gerenciar_pedidos() then
    raise exception 'Você não tem permissão para cancelar pedidos.';
  end if;

  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  if v_motivo is null then
    raise exception 'Informe o motivo do cancelamento.';
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
    raise exception 'Este pedido não pode mais ser cancelado.';
  end if;

  if v_order.status = 'confirmado' then
    for v_item in
      select variant_id, quantidade
      from public.order_items
      where order_id = p_order_id
      order by variant_id
    loop
      perform public.registrar_movimentacao_estoque(
        p_variant_id => v_item.variant_id,
        p_tipo => 'devolucao',
        p_quantidade => v_item.quantidade,
        p_motivo => 'Devolução por cancelamento do pedido #' || v_order.numero,
        p_referencia_tipo => 'pedido',
        p_referencia_id => p_order_id
      );
    end loop;
  end if;

  update public.orders
  set status = 'cancelado', motivo_cancelamento = v_motivo
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.cancelar_pedido(uuid, text) is
  'Cancela manualmente (REGRAS_DE_NEGOCIO.md §17.1) - a partir de aguardando_validacao ou confirmado. Se já estava confirmado (estoque baixado em validar_pedido), devolve via registrar_movimentacao_estoque (tipo=devolucao) - mesma função reaproveitada, agora somando em vez de subtrair. Exige motivo (mesma permissão de validar_pedido, decisão do PO em 21/08/2026).';

grant execute on function public.cancelar_pedido(uuid, text) to authenticated;

-- ---------- 7. RPC: concluir_pedido ----------
create or replace function public.concluir_pedido(
  p_order_id uuid
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
    raise exception 'Você não tem permissão para concluir pedidos.';
  end if;

  v_tenant_id := public.current_tenant_id();

  select * into v_order
  from public.orders
  where id = p_order_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_order.status <> 'confirmado' then
    raise exception 'Este pedido não está confirmado.';
  end if;

  update public.orders
  set status = 'concluido', data_efetiva = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.concluir_pedido(uuid) is
  'Marca a entrega como realizada (confirmado -> concluido), grava data_efetiva=now() (REGRAS_DE_NEGOCIO.md §19.2). Não mexe em estoque - a baixa já aconteceu em validar_pedido.';

grant execute on function public.concluir_pedido(uuid) to authenticated;

-- ---------- 8. RPC: cancelar_pedidos_expirados (sistema, SEM sessão) ----------
-- Chamada pelo GitHub Action cron (anon key, sem login nenhum) - por
-- isso NUNCA usa auth.uid()/is_staff()/staff_pode_gerenciar_pedidos().
-- Escopo vem 100% das condições do WHERE abaixo: status ainda
-- aguardando_validacao, cancelamento_automatico_habilitado=true NO
-- TENANT DAQUELE PEDIDO especificamente (join com store_settings pelo
-- próprio tenant_id do pedido, nunca um valor global), e mais velho
-- que o prazo configurado NAQUELE TENANT. Um único UPDATE...FROM -
-- Postgres cuida do lock de linha durante o UPDATE, sem precisar de
-- loop/cursor/FOR UPDATE explícito aqui (se um vendedor estiver
-- validando o mesmo pedido no exato mesmo instante, um dos dois
-- espera o lock do outro terminar; o WHERE é reavaliado contra o
-- estado atual da linha antes de aplicar, então nunca há
-- cancelamento duplicado nem sobrescrita perdida).
-- Nunca toca estoque: pedido aguardando_validacao nunca reservou nada.
create or replace function public.cancelar_pedidos_expirados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  with cancelados as (
    update public.orders o
    set status = 'cancelado',
        motivo_cancelamento = 'Cancelamento automático — prazo de validação expirado'
    from public.store_settings s
    where o.tenant_id = s.tenant_id
      and o.status = 'aguardando_validacao'
      and s.cancelamento_automatico_habilitado = true
      and o.created_at < now() - (s.prazo_cancelamento_automatico_horas || ' hours')::interval
    returning o.id
  )
  select count(*) into v_total from cancelados;

  return v_total;
end;
$$;

comment on function public.cancelar_pedidos_expirados() is
  'Roda SEM sessão (GitHub Action cron, anon key) - escopo 100% pelas condições do WHERE (status/prazo/flag POR TENANT), nunca por auth.uid()/is_staff(). Idempotente e autolimitada: só cancela o que já passou do prazo configurado em cada tenant, chamar cedo ou repetido não tem efeito colateral. Nunca mexe em estoque (aguardando_validacao nunca reservou nada). Retorna quantos pedidos foram cancelados, pro log do workflow.';

grant execute on function public.cancelar_pedidos_expirados() to anon, authenticated;
