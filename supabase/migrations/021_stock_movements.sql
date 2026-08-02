-- =====================================================
-- Modulo de Estoque — tabela stock_movements + RPC de movimentacao.
-- Decisao de produto fechada em 01/08/2026 (plano revisado e aprovado
-- pelo usuario nesta sessao).
--
-- Principio central (licao do projeto Almox da VLUMA, reaproveitada
-- aqui): o saldo (`product_variants.saldo_estoque`) e atualizado NA
-- APLICACAO/RPC, dentro da mesma transacao que grava a movimentacao —
-- NUNCA por trigger. No Almox, um trigger disparava antes dos itens
-- existirem de fato; a correcao definitiva la foi mover a atualizacao
-- de saldo pro codigo da RPC. Este projeto nasce ja assim, sem passar
-- pelo mesmo erro.
--
-- Isolamento multi-tenant: RPC e SECURITY DEFINER (ignora RLS), entao
-- a checagem de tenant_id = current_tenant_id() acontece explicitamente
-- no corpo da funcao (mesmo padrao de criar_produto_com_variacoes,
-- gerar_codigo_produto etc. — ver nota de isolamento na 016).
--
-- Modelo do ledger: `quantidade` e um delta ASSINADO (positivo soma,
-- negativo subtrai). saldo_estoque = soma de todas as movimentacoes da
-- variacao — `saldo_anterior`/`saldo_novo` sao snapshots gravados no
-- momento de cada movimentacao, pra o historico ser auto-suficiente
-- (nao precisa "rebobinar" a soma pra saber o saldo em qualquer ponto
-- do tempo). `product_id` e denormalizado (mesmo padrao ja usado em
-- product_price_history) pra listar o historico de um produto inteiro
-- sem join.
--
-- Movimentacoes sao IMUTAVEIS depois de criadas (ledger contabil, nao
-- registro editavel): sem updated_at, sem policy de UPDATE/DELETE.
-- Correcao de um lancamento errado e um novo lancamento (tipo=ajuste),
-- nunca uma edicao do lancamento original.
--
-- `referencia_tipo`/`referencia_id` (nullable, sem uso ainda): campo
-- preparado pro futuro modulo de Pedidos, que vai precisar dar baixa
-- de estoque na aceitacao do pedido (store_settings.baixa_estoque_na_reserva
-- ja antecipa esse comportamento). Incluido agora pra nao exigir outra
-- migration de schema quando Pedidos existir.
--
-- `usuario_id` e NULLABLE (nao NOT NULL): a maioria das movimentacoes
-- tem um staff real por tras (auth.uid() no momento da chamada), mas o
-- backfill desta migration (passo 6) e gerado pelo sistema, sem sessao
-- de usuario nenhuma — nesse caso fica null, exibido como "Sistema" na
-- tela de historico. Mais honesto que atribuir a movimentacao a um
-- staff qualquer que nao a fez de verdade.
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. Enum de tipo de movimentacao ----------
do $$ begin
  create type public.stock_movement_type as enum ('entrada', 'saida', 'ajuste', 'inventario', 'devolucao');
exception when duplicate_object then null; end $$;

-- ---------- 2. Tabela stock_movements ----------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  -- denormalizado de proposito (mesmo padrao de product_price_history)
  product_id uuid not null references public.products(id) on delete cascade,
  tipo public.stock_movement_type not null,
  -- delta assinado: positivo soma ao saldo, negativo subtrai
  quantidade integer not null,
  saldo_anterior integer not null,
  saldo_novo integer not null,
  motivo text,
  -- preparado pro futuro modulo de Pedidos (baixa de estoque na
  -- aceitacao) — sem uso ainda, ver nota no cabecalho
  referencia_tipo text,
  referencia_id uuid,
  -- null = movimentacao gerada pelo sistema (ex.: backfill desta
  -- migration), nao por um staff especifico — ver nota no cabecalho
  usuario_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),

  constraint chk_stock_movements_quantidade_nao_zero check (quantidade <> 0),
  -- amarracao tipo <-> sinal: entrada/devolucao/inventario sempre
  -- positivos, saida sempre negativo, ajuste livre (unico tipo pensado
  -- pra correcao em qualquer direcao)
  constraint chk_stock_movements_sinal check (
    (tipo = 'entrada' and quantidade > 0) or
    (tipo = 'saida' and quantidade < 0) or
    (tipo = 'devolucao' and quantidade > 0) or
    (tipo = 'inventario' and quantidade > 0) or
    (tipo = 'ajuste')
  ),
  -- saldo_novo tem que ser exatamente saldo_anterior + quantidade —
  -- garante que os snapshots nao podem divergir do delta gravado
  constraint chk_stock_movements_saldo_consistente check (saldo_novo = saldo_anterior + quantidade),
  constraint chk_stock_movements_saldo_nao_negativo check (saldo_anterior >= 0 and saldo_novo >= 0)
);

create index if not exists idx_stock_movements_variant on public.stock_movements(variant_id, created_at desc);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id, created_at desc);
create index if not exists idx_stock_movements_tenant on public.stock_movements(tenant_id, created_at desc);

-- ---------- 3. RLS ----------
alter table public.stock_movements enable row level security;

-- So staff, do proprio tenant. Sem policy de anon: modulo 100% interno,
-- nunca consumido pela vitrine.
drop policy if exists "stock_movements_select_staff" on public.stock_movements;
create policy "stock_movements_select_staff" on public.stock_movements
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists "stock_movements_insert_staff" on public.stock_movements;
create policy "stock_movements_insert_staff" on public.stock_movements
  for insert to authenticated
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- De proposito: NENHUMA policy de UPDATE nem DELETE. RLS nega por
-- padrao quando nao ha policy pro comando — nem admin consegue
-- editar/apagar uma movimentacao via PostgREST, so a RPC (SECURITY
-- DEFINER) consegue inserir. Reforca a imutabilidade do ledger no
-- proprio banco, nao so por convencao da aplicacao.

-- ---------- 4. Hardening: saldo_estoque so muda pela RPC ----------
-- Mesmo com a RLS de staff_write existente permitindo UPDATE em
-- product_variants (pros outros campos: nome, preco, sku etc.), essa
-- coluna especifica fica bloqueada pro role authenticated — so uma
-- funcao SECURITY DEFINER (que roda com o privilegio de quem criou a
-- funcao, nao do role authenticated) consegue escrever nela. Defesa em
-- profundidade: mesmo um bug futuro numa Route Handler que tentasse
-- um update() direto no client nao conseguiria bypassar o ledger.
revoke update (saldo_estoque) on public.product_variants from authenticated;

-- ---------- 5. RPC: registrar_movimentacao_estoque ----------
-- Dois jeitos de informar a quantidade, dependendo do tipo:
--   - entrada/saida/devolucao/ajuste "por delta": p_quantidade e o
--     delta assinado direto (ex.: saida de 5 unidades -> -5).
--   - ajuste "por saldo total": p_saldo_novo_desejado informa o saldo
--     final que deveria existir (ex.: recontagem fisica) — a funcao
--     calcula o delta sozinha, usando o saldo que ELA MESMA acabou de
--     travar com FOR UPDATE (nao um saldo lido antes pelo chamador,
--     que poderia estar desatualizado). Evita corrida entre "ler o
--     saldo pra mostrar na tela" e "calcular o delta".
-- Exatamente um dos dois (p_quantidade ou p_saldo_novo_desejado) deve
-- vir preenchido pra tipo='ajuste'; pros demais tipos, so p_quantidade.
create or replace function public.registrar_movimentacao_estoque(
  p_variant_id uuid,
  p_tipo public.stock_movement_type,
  p_quantidade integer default null,
  p_saldo_novo_desejado integer default null,
  p_motivo text default null,
  p_referencia_tipo text default null,
  p_referencia_id uuid default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variante record;
  v_delta integer;
  v_saldo_novo integer;
  v_motivo text;
  v_movimento public.stock_movements;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  if p_tipo = 'inventario' then
    raise exception 'O tipo "inventário" é gerado automaticamente pelo sistema e não pode ser registrado manualmente.';
  end if;

  -- Trava a linha aqui (FOR UPDATE): garante que duas movimentacoes
  -- concorrentes na mesma variacao nunca leem o mesmo saldo de partida
  -- e uma sobrescreve o resultado da outra.
  select saldo_estoque, modo_estoque, product_id
  into v_variante
  from public.product_variants
  where id = p_variant_id and tenant_id = public.current_tenant_id()
  for update;

  if not found then
    raise exception 'Variação não encontrada.';
  end if;

  if v_variante.modo_estoque <> 'quantitativo' then
    raise exception 'Esta variação não controla estoque por quantidade.';
  end if;

  if p_tipo = 'ajuste' and p_saldo_novo_desejado is not null then
    if p_quantidade is not null then
      raise exception 'Informe a quantidade OU o novo saldo, não os dois.';
    end if;
    if p_saldo_novo_desejado < 0 then
      raise exception 'O novo saldo não pode ser negativo.';
    end if;
    v_delta := p_saldo_novo_desejado - v_variante.saldo_estoque;
    if v_delta = 0 then
      raise exception 'O novo saldo informado é igual ao saldo atual — nenhuma movimentação é necessária.';
    end if;
  else
    if p_quantidade is null or p_quantidade = 0 then
      raise exception 'Informe uma quantidade diferente de zero.';
    end if;
    v_delta := p_quantidade;
  end if;

  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  if p_tipo = 'ajuste' and v_motivo is null then
    raise exception 'Informe o motivo do ajuste.';
  end if;

  v_saldo_novo := v_variante.saldo_estoque + v_delta;

  if v_saldo_novo < 0 then
    raise exception 'Estoque insuficiente. Saldo atual: % unidade(s).', v_variante.saldo_estoque;
  end if;

  begin
    insert into public.stock_movements (
      variant_id, product_id, tipo, quantidade, saldo_anterior, saldo_novo,
      motivo, referencia_tipo, referencia_id, usuario_id
    )
    values (
      p_variant_id, v_variante.product_id, p_tipo, v_delta, v_variante.saldo_estoque, v_saldo_novo,
      v_motivo, p_referencia_tipo, p_referencia_id, auth.uid()
    )
    returning * into v_movimento;
  exception
    when check_violation then
      raise exception 'Não foi possível registrar a movimentação. Confira o tipo e a quantidade.';
  end;

  update public.product_variants
  set saldo_estoque = v_saldo_novo
  where id = p_variant_id;

  return v_movimento;
end;
$$;

-- ---------- 6. Backfill: ledger nasce consistente com o saldo atual ----------
-- Toda variacao ativa que ja tem saldo_estoque > 0 hoje nunca passou
-- por uma movimentacao (o campo era escrito direto ate esta migration).
-- Sem isso, sum(stock_movements.quantidade) nao bateria com
-- product_variants.saldo_estoque pras variacoes que ja existem —
-- pouco risco agora (ambiente ainda sem catalogo real), mas passa a
-- importar assim que a importacao via CSV do catalogo do Cauã
-- acontecer (~1000 itens, ver ESCOPO_PROJETO.md "Planejadas").
-- usuario_id fica null (gerado pelo sistema, nao por um staff) — ver
-- nota no cabecalho.
insert into public.stock_movements (
  tenant_id, variant_id, product_id, tipo, quantidade, saldo_anterior, saldo_novo, motivo, usuario_id
)
select
  pv.tenant_id,
  pv.id,
  pv.product_id,
  'inventario',
  pv.saldo_estoque,
  0,
  pv.saldo_estoque,
  'Saldo inicial migrado — backfill da migration 021 (variação já existia antes do módulo de Estoque)',
  null
from public.product_variants pv
where pv.saldo_estoque > 0
  and pv.modo_estoque = 'quantitativo'
  and not exists (
    select 1 from public.stock_movements sm where sm.variant_id = pv.id
  );
