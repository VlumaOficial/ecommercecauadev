-- =====================================================
-- Fase 2 — sequência de ajustes operacionais, item (2): corrige o
-- bug 46 (provisionamento de staff via admin.createUser() quebrado,
-- ESCOPO_PROJETO.md §0 item 46/49 e §2 "Padrão de autenticação").
--
-- CAUSA RAIZ CONFIRMADA (não hipótese — ver §2 do escopo pro
-- diagnóstico completo com evidência): `admin.createUser({
-- app_metadata: { role: 'operador' } })` numa chamada só falha
-- silenciosamente. `handle_new_user` (migration 033) é
-- `AFTER INSERT ... FOR EACH ROW`, e lê `NEW.raw_app_meta_data` no
-- instante exato do INSERT. Teste decisivo: a MESMA chamada com
-- `user_metadata` (nome/whatsapp) E `app_metadata` (role) juntos
-- mostra que `raw_user_meta_data` chega correto nesse INSERT, mas
-- `raw_app_meta_data` não — o GoTrue grava `app_metadata` numa
-- escrita separada e POSTERIOR ao INSERT que a trigger já viu. Uma
-- trigger síncrona `AFTER INSERT` estruturalmente não pode "esperar"
-- por essa escrita futura de uma requisição diferente.
--
-- CORREÇÃO (opção "d", decidida com o PO em 24/08/2026): abandona a
-- ideia de "uma chamada resolve" pra provisionar staff. Processo
-- OFICIAL vira 2 passos explícitos, documentados:
--   1. `admin.createUser()` SEM nenhum `role` em `app_metadata` —
--      cai em `customers` de forma 100% previsível (é o mesmo
--      caminho que qualquer cadastro real de cliente já usa, sem
--      nenhuma corrida possível).
--   2. Esta RPC (`promover_para_staff`) — chamada DEPOIS que o
--      passo 1 já terminou (auth.users e customers já existem de
--      verdade) — faz a transição customers → profiles como uma
--      operação explícita, atômica, service_role-only.
--
-- NUNCA tentar fazer os dois passos numa chamada só de novo — é
-- exatamente isso que causa o bug 46. Isto não é uma correção do
-- comportamento do GoTrue (não temos controle sobre isso) — é a
-- eliminação do caminho que dependia dele.
--
-- SEGURANÇA (requisito inegociável mantido, migration 033): esta RPC
-- é SERVICE_ROLE-ONLY de forma ESTRUTURAL — revoke de
-- public/anon/authenticated, grant só pra service_role. O PostgREST
-- nem enxerga esta função pra uma sessão anon/authenticated —
-- diferente das outras RPCs do painel (que checam permissão em
-- runtime via staff_pode_gerenciar_pedidos() etc.), aqui a garantia
-- é "esse caminho não existe" pra qualquer sessão que não seja o
-- client servidor da própria aplicação (a Route Handler do item 3,
-- gestão de usuários, quando existir). Signup público (anon key)
-- continua estruturalmente incapaz de virar staff, em qualquer
-- hipótese — esta migration só acrescenta, não reabre nada da 033.
--
-- CASOS DE BORDA tratados explicitamente (decisão do PO, 24/08/2026):
--   - Chamar duas vezes / usuário já é staff: ERRO claro, não é
--     no-op nem atualiza o papel — promoção é uma transição única;
--     trocar o papel de quem já é staff é responsabilidade de uma
--     tela de EDITAR (item 3 da sequência), não desta RPC.
--   - Cliente com pedidos: ERRO claro ANTES de tentar apagar
--     `customers` — `orders.customer_id` é `on delete restrict`
--     (migration 037); sem esta checagem, a tentativa quebraria com
--     um erro cru de FK (jargão que REGRAS_DE_NEGOCIO.md §9 proíbe
--     expor ao usuário). Caso raro mas real (promover alguém que já
--     foi cliente de verdade antes de virar equipe) — o caso comum
--     (funcionário novo, zero pedidos) nunca esbarra nisso.
--   - Guards da migration 035 (impedem a mesma conta em `profiles` E
--     `customers` ao mesmo tempo): o DELETE de `customers` acontece
--     ANTES do INSERT em `profiles`, dentro da MESMA transação — no
--     instante em que o guard `trg_profiles_impedir_conta_dupla`
--     roda, a linha de `customers` já não existe mais, passa limpo.
--     Atômico: se o INSERT falhar por qualquer motivo, a transação
--     inteira desfaz (o DELETE também volta) — nunca fica um estado
--     "nem cliente nem staff" no meio do caminho.
-- =====================================================

create or replace function public.promover_para_staff(
  p_auth_user_id uuid,
  p_nome text,
  p_role public.user_role,
  p_pode_aceitar_pedido boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_email text;
  v_profile public.profiles;
begin
  -- O usuario auth precisa existir (criado pelo passo 1) - sem isso,
  -- nao ha o que promover. Le o e-mail direto de auth.users (fonte
  -- unica de verdade) em vez de receber como parametro - evita um
  -- e-mail inconsistente sendo passado por engano.
  select email into v_email from auth.users where id = p_auth_user_id;
  if v_email is null then
    raise exception 'Usuário não encontrado. Crie a conta antes de promover a staff.';
  end if;

  -- Nao e' idempotente de proposito (decisao do PO): chamar de novo
  -- pra quem ja e' staff e' erro, nao um no-op nem uma atualizacao
  -- silenciosa de papel.
  if exists (select 1 from public.profiles where id = p_auth_user_id) then
    raise exception 'Este usuário já faz parte da equipe.';
  end if;

  -- Cliente com pedidos nao pode ser promovido direto - orders.customer_id
  -- e' "on delete restrict" (migration 037), o DELETE mais abaixo
  -- quebraria com um erro cru de FK sem esta checagem.
  if exists (
    select 1
    from public.orders o
    join public.customers c on c.id = o.customer_id
    where c.auth_user_id = p_auth_user_id
  ) then
    raise exception 'Este cliente já tem pedidos registrados — não é possível promover a staff diretamente. Contate o suporte.';
  end if;

  -- MVP single-tenant, mesmo padrao ja usado em handle_new_user (006/033).
  select id into v_tenant_id from public.tenants where slug = 'capua' limit 1;

  -- Remove o registro de cliente ANTES de inserir em profiles - nessa
  -- ordem, o guard trg_profiles_impedir_conta_dupla (migration 035)
  -- ja nao encontra nenhuma linha em customers pra recusar. Sem erro
  -- se nao existir nenhuma linha (ex.: passo 1 rodou sem
  -- user_metadata e por algum motivo o registro nunca existiu) - e'
  -- um DELETE seguro, nao um requisito.
  delete from public.customers where auth_user_id = p_auth_user_id;

  insert into public.profiles (id, tenant_id, nome, email, role, pode_aceitar_pedido)
  values (p_auth_user_id, v_tenant_id, p_nome, v_email, p_role, p_pode_aceitar_pedido)
  returning * into v_profile;

  return v_profile;
end;
$$;

comment on function public.promover_para_staff(uuid, text, public.user_role, boolean) is
  'Passo 2 do provisionamento de staff (ESCOPO_PROJETO.md §2, correção do bug 46) - transforma um customer (criado sem role no passo 1, admin.createUser() sem app_metadata) numa linha em profiles. SERVICE_ROLE-ONLY (revoke de public/anon/authenticated abaixo) - nunca chamável por sessão de usuário comum. Não idempotente de propósito: chamar para quem já é staff é erro, não no-op - trocar papel é responsabilidade de uma tela de editar (item 3). Remove o customers correspondente antes do insert em profiles (ordem exigida pelos guards da migration 035); recusa se o cliente já tiver pedidos (orders.customer_id é on delete restrict).';

-- Funcao nasce com EXECUTE liberado pra PUBLIC por padrao no Postgres
-- - os tres revokes abaixo fecham isso explicitamente (o de "public"
-- ja bastaria sozinho, ja que anon/authenticated nunca tiveram grant
-- individual; os outros dois ficam explicitos por clareza/defesa em
-- profundidade). So' depois do revoke o grant restringe pra
-- service_role - e' esse par revoke+grant que faz o PostgREST parar
-- de enxergar esta funcao pra qualquer sessao anon/authenticated.
revoke execute on function public.promover_para_staff(uuid, text, public.user_role, boolean) from public;
revoke execute on function public.promover_para_staff(uuid, text, public.user_role, boolean) from anon;
revoke execute on function public.promover_para_staff(uuid, text, public.user_role, boolean) from authenticated;
grant execute on function public.promover_para_staff(uuid, text, public.user_role, boolean) to service_role;
