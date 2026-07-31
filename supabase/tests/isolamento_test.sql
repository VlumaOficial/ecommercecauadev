-- ============================================================
-- TESTE DE ISOLAMENTO POR TENANT — pós migration 013 aplicada
--
-- v5 (31/07/2026): ABANDONA tabela temporária por completo na Parte 2
-- (terceira falha distinta com temp table nesse fluxo de
-- impersonação: primeiro "permission denied" de leitura, depois de
-- escrita, agora "relation does not exist" — sinal de que depender
-- de qualquer tabela temporária atravessando `set role`/impersonação
-- no SQL Editor do Supabase não é confiável, seja qual for o motivo
-- exato). A Parte 2 agora roda como blocos `DO $$ ... $$` que
-- calculam cada verificação em variáveis locais (sem tocar em
-- nenhuma tabela auxiliar) e emitem o resultado via `RAISE NOTICE` —
-- essas mensagens aparecem TODAS juntas na aba "Messages"/log do SQL
-- Editor, na ordem em que rodam, independente de qual foi o "último
-- SELECT" (não existe mais SELECT solto pra essa parte) e
-- independente do `ROLLBACK` no final (RAISE NOTICE é enviado ao
-- cliente na hora, não faz parte dos dados que o rollback desfaz).
-- Passagem de valores entre a Parte 1 e a Parte 2 continua via
-- variável de sessão (`set_config`/`current_setting`, namespace
-- `myapp.*` — isso nunca falhou nos testes anteriores, só a parte de
-- tabela temporária). Trocar de role em plpgsql exige `EXECUTE 'set
-- local role authenticated'` (comando SET não é uma instrução
-- plpgsql direta, só via SQL dinâmico); contagem de linhas afetadas
-- por UPDATE vem de `GET DIAGNOSTICS ... = ROW_COUNT` em vez de
-- `RETURNING` (não precisamos mais de um `INSERT ... SELECT ...
-- FROM (UPDATE ... RETURNING)` como antes).
--
-- v3 (31/07/2026): elimina a tabela temporária usada pra passar os
-- UUIDs entre a Parte 1 e a Parte 2. Motivo: a temp table é criada
-- pelo role de conexão do SQL Editor (postgres/admin), e a Parte 2
-- troca pro role `authenticated` via `set role` — que não tem
-- privilégio nenhum sobre uma tabela criada por outro role, mesmo
-- temporária ("permission denied for table _teste_isolamento_ids").
-- Trocado por variáveis de sessão custom (`set_config`/
-- `current_setting`, namespace `myapp.*`), que não são objetos de
-- banco com dono/permissão — qualquer role na mesma sessão consegue
-- ler, exatamente como o próprio `request.jwt.claims` já funciona
-- pro `auth.uid()` do Supabase.
--
-- v2 (31/07/2026): reescrito para NÃO tocar em nenhuma FK/constraint.
-- A v1 deste arquivo relaxava temporariamente o FK
-- profiles.id -> auth.users(id) para criar um perfil sintético sem
-- usuário real no Auth. Substituído porque agora existe um usuário
-- real no Supabase Auth criado especificamente para este teste
-- (UUID 8c0c4252-a38e-406f-94f7-a6f2aa3b7dcb) — a FK já é satisfeita
-- naturalmente, sem precisar relaxar nada.
--
-- Roda no SQL Editor do Supabase (conecta como `postgres`, que
-- bypassa RLS por padrão — por isso a impersonação na Parte 2).
-- NÃO é uma migration — é um script de verificação, reaproveitável
-- sempre que RLS mudar de novo no futuro.
--
-- ATENÇÃO — efeito colateral real: este script MOVE o profile do
-- usuário 8c0c4252-a38e-406f-94f7-a6f2aa3b7dcb para o tenant de
-- teste (não cria uma cópia). Se esse usuário for hoje o ÚNICO staff
-- ativo do Cauã, a Parte 1 se recusa a rodar (ver guarda de
-- segurança) — precisa existir OUTRO staff ativo do Cauã antes.
-- Projeto: Criatorio Capua
-- ============================================================


-- ============================================================
-- PARTE 0 — DIAGNÓSTICO (somente leitura, roda a qualquer momento)
-- Mostra onde o profile desse UUID está HOJE, antes de qualquer
-- mudança. Se o trigger handle_new_user já rodou no cadastro deste
-- usuário, ele deve aparecer aqui com tenant_slug = 'capua'.
-- ============================================================

select
  p.id,
  p.nome,
  p.email,
  p.role,
  p.ativo,
  p.tenant_id,
  t.slug as tenant_slug,
  t.nome as tenant_nome
from public.profiles p
join public.tenants t on t.id = p.tenant_id
where p.id = '8c0c4252-a38e-406f-94f7-a6f2aa3b7dcb';

-- Só por garantia: confere se por acaso o trigger jogou pra
-- "customers" em vez de "profiles" (aconteceria se o metadata de
-- signup não tivesse role='admin'/'operador').
select
  c.id,
  c.auth_user_id,
  c.nome,
  c.tenant_id,
  t.slug as tenant_slug
from public.customers c
join public.tenants t on t.id = c.tenant_id
where c.auth_user_id = '8c0c4252-a38e-406f-94f7-a6f2aa3b7dcb';


-- ============================================================
-- PARTE 1 — SETUP (efeito real e persistente, committed de verdade)
-- Cria o tenant sintético (idempotente) + move (ou cria, se o
-- trigger não criou nada) o profile do usuário real pro tenant de
-- teste, role='admin' + 1 categoria e 1 cidade vinculadas só a ele.
-- NENHUM ALTER TABLE, NENHUMA FK tocada em momento algum.
-- ============================================================

do $$
declare
  v_uuid_teste      uuid := '8c0c4252-a38e-406f-94f7-a6f2aa3b7dcb';
  v_tenant_teste    uuid;
  v_tenant_capua    uuid;
  v_profile_capua   uuid;
  v_email           text;
  v_existe_profile  boolean;
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

  -- ---------- guarda de segurança: precisa sobrar staff no Cauã ----------
  -- Se o usuário de teste for o único staff ativo do Cauã, movê-lo
  -- deixaria o Cauã sem ninguém logável no painel. Aborta antes de
  -- fazer qualquer mudança.
  select id into v_profile_capua
  from public.profiles
  where tenant_id = v_tenant_capua and ativo = true and id <> v_uuid_teste
  limit 1;

  if v_profile_capua is null then
    raise exception 'Não existe outro staff ativo no Cauã além de %. Abortando: mover este perfil deixaria o Cauã sem staff logável. Crie/ative outro admin ou operador do Cauã antes de rodar este teste.', v_uuid_teste;
  end if;

  -- ---------- move (ou cria) o profile do usuário real pro tenant de teste ----------
  select exists(select 1 from public.profiles where id = v_uuid_teste) into v_existe_profile;

  if v_existe_profile then
    update public.profiles
    set tenant_id = v_tenant_teste, role = 'admin', ativo = true
    where id = v_uuid_teste;
    raise notice 'Profile % MOVIDO para o tenant de teste (estava em outro tenant).', v_uuid_teste;
  else
    select email into v_email from auth.users where id = v_uuid_teste;
    if v_email is null then
      raise exception 'Usuário % não encontrado em auth.users — confirme o UUID antes de rodar de novo.', v_uuid_teste;
    end if;
    insert into public.profiles (id, tenant_id, nome, email, role, ativo)
    values (v_uuid_teste, v_tenant_teste, 'TESTE - Staff Canário', v_email, 'admin', true);
    raise notice 'Profile % CRIADO no tenant de teste (o trigger não tinha criado nenhum profile pra ele).', v_uuid_teste;
  end if;

  -- ---------- dado de domínio do tenant de teste ----------
  insert into public.categories (tenant_id, nome, slug, ativo)
  select v_tenant_teste, 'TESTE - Categoria Canário', 'teste-categoria-canario', true
  where not exists (select 1 from public.categories where tenant_id = v_tenant_teste);

  insert into public.delivery_cities (tenant_id, nome, uf, ativo)
  select v_tenant_teste, 'TESTE - Cidade Canário', 'XX', true
  where not exists (select 1 from public.delivery_cities where tenant_id = v_tenant_teste);

  -- ---------- guarda os ids pra Parte 2 usar (variável de sessão, ----------
  -- ---------- não tabela — legível por qualquer role, sem GRANT) ----------
  perform set_config('myapp.tenant_teste',  v_tenant_teste::text,  false);
  perform set_config('myapp.tenant_capua',  v_tenant_capua::text,  false);
  perform set_config('myapp.profile_teste', v_uuid_teste::text,    false);
  perform set_config('myapp.profile_capua', v_profile_capua::text, false);

  raise notice 'Setup OK — tenant_teste=%, tenant_capua=%, profile_teste=%, profile_capua=%',
    v_tenant_teste, v_tenant_capua, v_uuid_teste, v_profile_capua;
end $$;


-- ============================================================
-- PARTE 2 — IMPERSONAÇÃO E VERIFICAÇÃO (via RAISE NOTICE, sem tabela)
--
-- Tudo dentro de UMA transação que sempre termina em ROLLBACK —
-- mesmo que algum UPDATE cross-tenant "funcionasse" (não deveria),
-- fica desfeito automaticamente. As mensagens RAISE NOTICE já foram
-- enviadas ao cliente no momento em que rodam, então aparecem todas
-- na aba "Messages"/log do SQL Editor independente do rollback.
-- Nenhuma tabela (nem temporária) é criada nesta parte.
-- ============================================================

begin;

do $$
declare
  v_tenant_teste  uuid := current_setting('myapp.tenant_teste')::uuid;
  v_tenant_capua  uuid := current_setting('myapp.tenant_capua')::uuid;
  v_profile_teste uuid := current_setting('myapp.profile_teste')::uuid;
  v_profile_capua uuid := current_setting('myapp.profile_capua')::uuid;
  v_proprio  integer;
  v_outro    integer;
  v_afetadas integer;
begin
  raise notice '======================================================';
  raise notice '2.1 — IMPERSONANDO O USUÁRIO DE TESTE (movido pro tenant de teste)';
  raise notice '======================================================';

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_teste::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select count(*) filter (where tenant_id = v_tenant_teste), count(*) filter (where tenant_id = v_tenant_capua)
    into v_proprio, v_outro from public.categories;
  raise notice '[LEITURA] categories: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_teste), count(*) filter (where tenant_id = v_tenant_capua)
    into v_proprio, v_outro from public.category_attributes;
  raise notice '[LEITURA] category_attributes: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_teste), count(*) filter (where tenant_id = v_tenant_capua)
    into v_proprio, v_outro from public.products;
  raise notice '[LEITURA] products: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_teste), count(*) filter (where tenant_id = v_tenant_capua)
    into v_proprio, v_outro from public.product_variants;
  raise notice '[LEITURA] product_variants: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_teste), count(*) filter (where tenant_id = v_tenant_capua)
    into v_proprio, v_outro from public.delivery_cities;
  raise notice '[LEITURA] delivery_cities: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_teste), count(*) filter (where tenant_id = v_tenant_capua)
    into v_proprio, v_outro from public.customers;
  raise notice '[LEITURA] customers: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_teste), count(*) filter (where tenant_id = v_tenant_capua)
    into v_proprio, v_outro from public.store_settings;
  raise notice '[LEITURA] store_settings: proprio=%, outro=%  ->  OK (público por design, não restrito por tenant — ver nota)',
    v_proprio, v_outro;

  update public.categories
  set descricao = 'TENTATIVA DE ESCRITA CROSS-TENANT — não deveria afetar nada'
  where tenant_id = v_tenant_capua;
  get diagnostics v_afetadas = row_count;
  raise notice '[ESCRITA] UPDATE categories do Cauã (impersonando TESTE): linhas_afetadas=%  ->  %',
    v_afetadas, case when v_afetadas = 0 then 'OK' else 'VAZAMENTO' end;

  update public.delivery_cities
  set observacoes = 'TENTATIVA DE ESCRITA CROSS-TENANT — não deveria afetar nada'
  where tenant_id = v_tenant_capua;
  get diagnostics v_afetadas = row_count;
  raise notice '[ESCRITA] UPDATE delivery_cities do Cauã (impersonando TESTE): linhas_afetadas=%  ->  %',
    v_afetadas, case when v_afetadas = 0 then 'OK' else 'VAZAMENTO' end;

  execute 'reset role';

  raise notice '======================================================';
  raise notice '2.2 — IMPERSONANDO UM STAFF REAL DO CAUÃ (sentido inverso)';
  raise notice '======================================================';

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_capua::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select count(*) filter (where tenant_id = v_tenant_capua), count(*) filter (where tenant_id = v_tenant_teste)
    into v_proprio, v_outro from public.categories;
  raise notice '[LEITURA] categories: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_capua), count(*) filter (where tenant_id = v_tenant_teste)
    into v_proprio, v_outro from public.category_attributes;
  raise notice '[LEITURA] category_attributes: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_capua), count(*) filter (where tenant_id = v_tenant_teste)
    into v_proprio, v_outro from public.products;
  raise notice '[LEITURA] products: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_capua), count(*) filter (where tenant_id = v_tenant_teste)
    into v_proprio, v_outro from public.product_variants;
  raise notice '[LEITURA] product_variants: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_capua), count(*) filter (where tenant_id = v_tenant_teste)
    into v_proprio, v_outro from public.delivery_cities;
  raise notice '[LEITURA] delivery_cities: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_capua), count(*) filter (where tenant_id = v_tenant_teste)
    into v_proprio, v_outro from public.customers;
  raise notice '[LEITURA] customers: proprio=%, outro=%  ->  %',
    v_proprio, v_outro, case when v_outro = 0 then 'OK' else 'VAZAMENTO' end;

  select count(*) filter (where tenant_id = v_tenant_capua), count(*) filter (where tenant_id = v_tenant_teste)
    into v_proprio, v_outro from public.store_settings;
  raise notice '[LEITURA] store_settings: proprio=%, outro=%  ->  OK (público por design, não restrito por tenant — ver nota)',
    v_proprio, v_outro;

  update public.categories
  set descricao = 'TENTATIVA DE ESCRITA CROSS-TENANT — não deveria afetar nada'
  where tenant_id = v_tenant_teste;
  get diagnostics v_afetadas = row_count;
  raise notice '[ESCRITA] UPDATE categories do TESTE (impersonando CAUÃ): linhas_afetadas=%  ->  %',
    v_afetadas, case when v_afetadas = 0 then 'OK' else 'VAZAMENTO' end;

  execute 'reset role';

  raise notice '======================================================';
  raise notice 'FIM DAS VERIFICAÇÕES — a seguir vem o ROLLBACK (nada disso fica gravado)';
  raise notice '======================================================';
end $$;

rollback;


-- ============================================================
-- PARTE 3 — SITUAÇÃO FINAL (sem limpeza automática)
--
-- Decisão já tomada: manter o canário permanente. Como NENHUMA FK
-- foi tocada em nenhum momento (diferente da v1 deste script), NÃO
-- HÁ NADA A RESTAURAR — o banco já fica no estado final assim que a
-- Parte 1 termina de rodar. O que ficou no banco, pra sempre (até
-- decisão em contrário):
--   - tenant '_teste_isolamento' (ativo=false)
--   - profile de 8c0c4252-a38e-406f-94f7-a6f2aa3b7dcb, agora
--     pertencendo a esse tenant, role='admin' — este usuário PODE
--     logar de verdade na UI (é um Auth user real) e vai cair no
--     contexto do tenant de teste, nunca no do Cauã, a partir de agora
--   - 1 categoria e 1 cidade de teste vinculadas a esse tenant
--
-- Bônus sobre a v1: como agora é um usuário real, esse canário
-- também serve pra confirmação "Chromium real" (login de verdade),
-- não só pra impersonação via SQL Editor.
--
-- Reversão (opcional, comentada) — só se um dia quiser desfazer e
-- devolver este usuário pro Cauã:
-- ============================================================

-- do $$
-- declare
--   v_uuid_teste   uuid := '8c0c4252-a38e-406f-94f7-a6f2aa3b7dcb';
--   v_tenant_capua uuid;
-- begin
--   select id into v_tenant_capua from public.tenants where slug = 'capua';
--   update public.profiles set tenant_id = v_tenant_capua where id = v_uuid_teste;
--   delete from public.categories where tenant_id = (select id from public.tenants where slug = '_teste_isolamento');
--   delete from public.delivery_cities where tenant_id = (select id from public.tenants where slug = '_teste_isolamento');
--   delete from public.tenants where slug = '_teste_isolamento';
-- end $$;
