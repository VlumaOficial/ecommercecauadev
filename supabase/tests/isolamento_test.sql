-- ============================================================
-- TESTE DE ISOLAMENTO POR TENANT — pós migration 013 aplicada
--
-- Roda no SQL Editor do Supabase (conecta como `postgres`, que
-- bypassa RLS por padrão — por isso a impersonação na Parte 2).
-- NÃO é uma migration (não fica em supabase/migrations/, não
-- muda schema de forma permanente) — é um script de verificação,
-- reaproveitável sempre que RLS mudar de novo no futuro.
--
-- Este arquivo cola inteiro no SQL Editor. As Partes 1 e 2 são
-- seguras de rodar juntas (Parte 2 sempre dá ROLLBACK, mesmo se
-- algo "vazar"). A Parte 3 (limpeza) é OPCIONAL e não roda
-- automaticamente — role até lá, escolha um dos dois blocos, rode
-- só ele depois de já ter visto os resultados da Parte 2.
-- Projeto: Criatorio Capua
-- ============================================================


-- ============================================================
-- PARTE 1 — SETUP (efeito real e persistente, committed de verdade)
-- Cria o tenant sintético (idempotente — se já existir, reaproveita)
-- + 1 categoria e 1 cidade de entrega vinculadas só a ele + 1 perfil
-- de staff sintético (sem usuário real no Auth, de propósito — só
-- serve pra impersonação via SQL, nunca conseguiria logar na UI).
--
-- Pra isso, relaxa TEMPORARIAMENTE o FK profiles.id -> auth.users(id)
-- (drop, sem precisar saber o nome exato da constraint). ALTER TABLE
-- DROP/ADD CONSTRAINT aqui é operação de metadado, rápida, não
-- reescreve a tabela nem trava tráfego concorrente por muito tempo.
-- A Parte 3 decide se esse FK volta validado (descartando o canário)
-- ou como NOT VALID (mantendo o canário, protegendo inserts futuros).
-- ============================================================

do $$
declare
  v_tenant_teste     uuid;
  v_tenant_capua     uuid;
  v_profile_teste    uuid := gen_random_uuid();
  v_profile_capua    uuid;
  v_fk_name          text;
begin
  -- ---------- tenant sintético ----------
  insert into public.tenants (slug, nome, ativo)
  values ('_teste_isolamento', 'TESTE — Canário de Isolamento (não é loja real)', false)
  on conflict (slug) do nothing;

  select id into v_tenant_teste from public.tenants where slug = '_teste_isolamento';
  select id into v_tenant_capua from public.tenants where slug = 'capua';

  if v_tenant_capua is null then
    raise exception 'Tenant capua não encontrado — aborte e investigue antes de continuar.';
  end if;

  -- ---------- relaxa o FK profiles.id -> auth.users(id) ----------
  select conname into v_fk_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and confrelid = 'auth.users'::regclass
    and contype = 'f';

  if v_fk_name is not null then
    execute format('alter table public.profiles drop constraint %I', v_fk_name);
    raise notice 'FK % removido temporariamente (restaurado na Parte 3).', v_fk_name;
  else
    raise notice 'FK profiles->auth.users já estava ausente (script rodado antes sem restaurar na Parte 3?).';
  end if;

  -- ---------- perfil de staff sintético (reaproveita se já existir) ----------
  select id into v_profile_teste from public.profiles where tenant_id = v_tenant_teste limit 1;
  if v_profile_teste is null then
    v_profile_teste := gen_random_uuid();
    insert into public.profiles (id, tenant_id, nome, email, role, ativo)
    values (v_profile_teste, v_tenant_teste, 'TESTE - Staff Canário', 'teste-isolamento@invalido.local', 'admin', true);
  end if;

  -- ---------- staff REAL do Cauã, pra impersonar no sentido inverso ----------
  select id into v_profile_capua
  from public.profiles
  where tenant_id = v_tenant_capua and ativo = true
  limit 1;

  if v_profile_capua is null then
    raise exception 'Nenhum staff ativo encontrado no tenant capua — crie um antes de rodar este teste.';
  end if;

  -- ---------- dado de domínio do tenant de teste ----------
  insert into public.categories (tenant_id, nome, slug, ativo)
  select v_tenant_teste, 'TESTE - Categoria Canário', 'teste-categoria-canario', true
  where not exists (select 1 from public.categories where tenant_id = v_tenant_teste);

  insert into public.delivery_cities (tenant_id, nome, uf, ativo)
  select v_tenant_teste, 'TESTE - Cidade Canário', 'XX', true
  where not exists (select 1 from public.delivery_cities where tenant_id = v_tenant_teste);

  -- ---------- guarda os ids pra Parte 2 usar (só existe nesta sessão) ----------
  create temporary table if not exists _teste_isolamento_ids (chave text primary key, valor uuid);
  insert into _teste_isolamento_ids (chave, valor) values
    ('tenant_teste',  v_tenant_teste),
    ('tenant_capua',  v_tenant_capua),
    ('profile_teste', v_profile_teste),
    ('profile_capua', v_profile_capua)
  on conflict (chave) do update set valor = excluded.valor;

  raise notice 'Setup OK — tenant_teste=%, tenant_capua=%, profile_teste=%, profile_capua=%',
    v_tenant_teste, v_tenant_capua, v_profile_teste, v_profile_capua;
end $$;


-- ============================================================
-- PARTE 2 — IMPERSONAÇÃO E VERIFICAÇÃO
--
-- Tudo dentro de UMA transação que sempre termina em ROLLBACK —
-- mesmo que algum UPDATE cross-tenant "funcionasse" (não deveria),
-- fica desfeito automaticamente. Os SELECTs de contagem continuam
-- aparecendo normalmente nos resultados do SQL Editor antes do
-- rollback acontecer.
-- ============================================================

begin;

-- ---------- 2.1: impersonando o STAFF DO TENANT DE TESTE ----------
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select valor from _teste_isolamento_ids where chave = 'profile_teste'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

-- Verificação A — leitura: "linhas_outro_tenant" tem que ser 0 em
-- TODA linha, exceto store_settings (leitura pública por design —
-- ver nota abaixo da tabela de resultados esperados).
with ids as (
  select
    (select valor from _teste_isolamento_ids where chave = 'tenant_teste') as teste,
    (select valor from _teste_isolamento_ids where chave = 'tenant_capua') as capua
)
select 'categories' as tabela,
  count(*) filter (where t.tenant_id = ids.teste) as linhas_proprio_tenant,
  count(*) filter (where t.tenant_id = ids.capua) as linhas_outro_tenant
from public.categories t, ids
union all
select 'category_attributes',
  count(*) filter (where t.tenant_id = ids.teste), count(*) filter (where t.tenant_id = ids.capua)
from public.category_attributes t, ids
union all
select 'products',
  count(*) filter (where t.tenant_id = ids.teste), count(*) filter (where t.tenant_id = ids.capua)
from public.products t, ids
union all
select 'product_variants',
  count(*) filter (where t.tenant_id = ids.teste), count(*) filter (where t.tenant_id = ids.capua)
from public.product_variants t, ids
union all
select 'delivery_cities',
  count(*) filter (where t.tenant_id = ids.teste), count(*) filter (where t.tenant_id = ids.capua)
from public.delivery_cities t, ids
union all
select 'customers',
  count(*) filter (where t.tenant_id = ids.teste), count(*) filter (where t.tenant_id = ids.capua)
from public.customers t, ids
union all
select 'store_settings (público por design — ver nota)',
  count(*) filter (where t.tenant_id = ids.teste), count(*) filter (where t.tenant_id = ids.capua)
from public.store_settings t, ids
order by 1;

-- Verificação B — escrita: tentativa de UPDATE em categoria do Cauã
-- impersonando o staff do tenant de teste. Esperado: 0 linhas afetadas.
with tentativa as (
  update public.categories
  set descricao = 'TENTATIVA DE ESCRITA CROSS-TENANT — não deveria afetar nada'
  where tenant_id = (select valor from _teste_isolamento_ids where chave = 'tenant_capua')
  returning 1
)
select 'UPDATE em categories do Cauã, impersonando TESTE' as tentativa, count(*) as linhas_afetadas from tentativa;

-- mesma verificação em delivery_cities, pra não confiar só numa tabela
with tentativa as (
  update public.delivery_cities
  set observacoes = 'TENTATIVA DE ESCRITA CROSS-TENANT — não deveria afetar nada'
  where tenant_id = (select valor from _teste_isolamento_ids where chave = 'tenant_capua')
  returning 1
)
select 'UPDATE em delivery_cities do Cauã, impersonando TESTE' as tentativa, count(*) as linhas_afetadas from tentativa;

reset role;

-- ---------- 2.2: impersonando o STAFF DO CAUÃ (sentido inverso) ----------
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select valor from _teste_isolamento_ids where chave = 'profile_capua'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

-- Verificação C — leitura inversa: "linhas_outro_tenant" (o de teste)
-- tem que ser 0 em toda linha, exceto store_settings.
with ids as (
  select
    (select valor from _teste_isolamento_ids where chave = 'tenant_capua') as capua,
    (select valor from _teste_isolamento_ids where chave = 'tenant_teste') as teste
)
select 'categories' as tabela,
  count(*) filter (where t.tenant_id = ids.capua) as linhas_proprio_tenant,
  count(*) filter (where t.tenant_id = ids.teste) as linhas_outro_tenant
from public.categories t, ids
union all
select 'category_attributes',
  count(*) filter (where t.tenant_id = ids.capua), count(*) filter (where t.tenant_id = ids.teste)
from public.category_attributes t, ids
union all
select 'products',
  count(*) filter (where t.tenant_id = ids.capua), count(*) filter (where t.tenant_id = ids.teste)
from public.products t, ids
union all
select 'product_variants',
  count(*) filter (where t.tenant_id = ids.capua), count(*) filter (where t.tenant_id = ids.teste)
from public.product_variants t, ids
union all
select 'delivery_cities',
  count(*) filter (where t.tenant_id = ids.capua), count(*) filter (where t.tenant_id = ids.teste)
from public.delivery_cities t, ids
union all
select 'customers',
  count(*) filter (where t.tenant_id = ids.capua), count(*) filter (where t.tenant_id = ids.teste)
from public.customers t, ids
union all
select 'store_settings (público por design — ver nota)',
  count(*) filter (where t.tenant_id = ids.capua), count(*) filter (where t.tenant_id = ids.teste)
from public.store_settings t, ids
order by 1;

-- Verificação D — tentativa de UPDATE em categoria do tenant de teste
-- impersonando o staff do Cauã. Esperado: 0 linhas afetadas.
with tentativa as (
  update public.categories
  set descricao = 'TENTATIVA DE ESCRITA CROSS-TENANT — não deveria afetar nada'
  where tenant_id = (select valor from _teste_isolamento_ids where chave = 'tenant_teste')
  returning 1
)
select 'UPDATE em categories do TESTE, impersonando CAUÃ' as tentativa, count(*) as linhas_afetadas from tentativa;

reset role;

rollback;


-- ============================================================
-- PARTE 3 — LIMPEZA (OPCIONAL, NÃO AUTOMÁTICA)
-- Escolha UM dos dois blocos abaixo e rode manualmente, depois de
-- já ter visto os resultados da Parte 2. Não rode os dois.
-- ============================================================

-- ---------- OPÇÃO A: manter como canário permanente (decisão já tomada) ----------
-- Restaura o FK como NOT VALID: protege todo INSERT/UPDATE futuro em
-- profiles.id (exige auth.users real dali pra frente), sem exigir
-- validar a linha sintética já existente (que não tem auth.users
-- correspondente, de propósito). O canário continua só utilizável via
-- impersonação SQL (Parte 2) — nunca vai conseguir logar de verdade
-- na UI, porque não existe usuário real no Auth por trás dele. Se no
-- futuro quiser também testar via login real (Chromium), crie um
-- usuário de verdade no Auth com este mesmo tenant separadamente —
-- ação adicional, fora deste script.
do $$
declare
  v_fk_name text;
begin
  select conname into v_fk_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass and confrelid = 'auth.users'::regclass and contype = 'f';

  if v_fk_name is null then
    execute 'alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade not valid';
    raise notice 'FK restaurado como NOT VALID — canário mantido.';
  else
    raise notice 'FK já existe (%), nada a fazer.', v_fk_name;
  end if;
end $$;

drop table if exists _teste_isolamento_ids;


-- ---------- OPÇÃO B: descartar tudo (não manter canário) ----------
-- Todas as linhas comentadas de propósito — descomente e rode só se
-- realmente quiser apagar o tenant de teste e tudo que está nele.
-- delete from public.categories where tenant_id = (select id from public.tenants where slug = '_teste_isolamento');
-- delete from public.delivery_cities where tenant_id = (select id from public.tenants where slug = '_teste_isolamento');
-- delete from public.profiles where tenant_id = (select id from public.tenants where slug = '_teste_isolamento');
-- delete from public.tenants where slug = '_teste_isolamento';
-- -- restaura o FK validado de verdade (sem linha violando, valida limpo):
-- alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
-- drop table if exists _teste_isolamento_ids;
