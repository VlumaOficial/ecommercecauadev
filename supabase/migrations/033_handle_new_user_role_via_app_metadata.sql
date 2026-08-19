-- =====================================================
-- Fase 2 (Carrinho/Checkout, incremento 2 — Contas de cliente):
-- fecha o GAP CRÍTICO de segurança encontrado antes de começar
-- a construir cadastro de cliente em cima da base atual.
--
-- O PROBLEMA (migration 006, handle_new_user original):
-- a trigger decidia staff-vs-cliente lendo `role` de
-- `raw_user_meta_data` (exposto como `user_metadata`) — campo
-- que QUALQUER chamada pública a `supabase.auth.signUp()` (com
-- a `anon key`, pública por natureza, embutida em todo site
-- publicado) pode preencher livremente via `options.data`.
-- Nada no servidor impedia alguém de ignorar o formulário
-- `/cadastro` (que hardcoda `role: 'cliente'`) e chamar
-- `signUp()` direto passando `data: { role: 'admin' }`,
-- virando staff com acesso total a `/painel` depois de
-- confirmar o e-mail.
--
-- DIAGNÓSTICO PRÉVIO (leitura de `profiles` + `auth.users` via
-- Admin API, service role, só leitura — sem escrita nenhuma):
-- os 2 staff reais de hoje (`adm@criatoriocapua.com.br` e o
-- canário de isolamento `teste-isolamento@vluma.local`) foram
-- os DOIS provisionados por canal já privilegiado —
-- `email_confirmed_at` idêntico a `created_at` no primeiro
-- (assinatura de `auth.admin.createUser()` com
-- `email_confirm:true`, nunca de signup público) e ausência de
-- `role` no metadata do segundo (staff inserido direto via SQL,
-- bypassando a trigger por completo). Nenhum dos dois passou
-- pelo caminho vulnerável — fechar o gap não quebra o processo
-- de onboarding de staff já em uso.
--
-- A CORREÇÃO: a trigger passa a ler `role` de
-- `raw_app_meta_data` (exposto como `app_metadata`) em vez de
-- `raw_user_meta_data`. Essa é a distinção estrutural que o
-- Auth do Supabase já garante: `app_metadata` NUNCA é
-- gravável pelo próprio usuário — nem por `signUp()`, nem por
-- `updateUser()`, em nenhum dos dois casos, com ou sem sessão.
-- Só é gravável pela Admin API (`auth.admin.createUser`/
-- `updateUserById`), que exige a service role key. Um signup
-- público (anon key, `/cadastro` ou qualquer chamada direta a
-- `signUp()`) é ESTRUTURALMENTE incapaz de influenciar esse
-- campo — não importa o payload enviado. Por isso o gap fecha
-- de verdade (garantia da própria API do Supabase), não só por
-- convenção de código que alguém poderia esquecer de respeitar
-- num formulário futuro.
--
-- `raw_user_meta_data->>'role'` deixa de ser lido em QUALQUER
-- hipótese para decidir papel — mesmo que um signup público
-- envie esse campo (com qualquer valor), ele é simplesmente
-- ignorado. `nome`/`whatsapp`/`delivery_city_id` continuam
-- vindo de `raw_user_meta_data` normalmente — são dado de
-- perfil legítimo do formulário de cadastro, sem risco de
-- autorização (nunca decidem papel, só preenchem campos de
-- texto/referência do próprio registro que o usuário já teria
-- direito de criar).
--
-- CAMINHO PRIVILEGIADO DE CRIAR STAFF (Admin API/INSERT direto)
-- CONTINUA FUNCIONANDO, com um ajuste mínimo: quem provisiona
-- staff via Admin API passa a enviar `role` em `app_metadata`
-- em vez de `user_metadata` nessa chamada pontual (mesmo
-- processo manual/formalizado já em uso hoje, sem rota nova —
-- decisão registrada de não criar uma rota `is_admin()` agora,
-- volume de staff é baixíssimo). INSERT direto em `profiles`
-- via SQL/service role continua funcionando sem nenhuma
-- mudança (nunca passou pela trigger pra começo de conversa).
--
-- Puramente uma correção de função (`create or replace`) — não
-- altera nenhuma tabela, coluna, policy ou dado existente.
-- Staff já cadastrado (as 2 contas reais) não é tocado; a
-- mudança só vale para INSERTs futuros em `auth.users`.
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_role text;
  v_nome text;
  v_whatsapp text;
  v_city_id uuid;
begin
  -- tenant padrao (MVP single-tenant)
  select id into v_tenant_id from public.tenants where slug = 'capua' limit 1;

  -- SEGURANCA: papel vem SO' de app_metadata (raw_app_meta_data)
  -- - campo que a Auth API do Supabase nunca deixa o proprio
  -- usuario setar (signUp()/updateUser() publicos nao alcancam
  -- esse campo em nenhuma hipotese, so' a Admin API com service
  -- role grava nele). raw_user_meta_data->>'role' NUNCA e' lido
  -- aqui, ainda que um signup publico envie esse campo - fica
  -- completamente ignorado pra decisao de papel.
  v_role := coalesce(new.raw_app_meta_data->>'role', 'cliente');

  -- Dado de perfil legitimo, sem risco de autorizacao - continua
  -- vindo do metadata que o proprio formulario de cadastro envia.
  v_nome     := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  v_whatsapp := new.raw_user_meta_data->>'whatsapp';

  if v_role in ('admin', 'operador') then
    -- Equipe interna - so' alcancavel via app_metadata setado
    -- pela Admin API (service role). Impossivel chegar aqui a
    -- partir de um signup feito com a anon key.
    insert into public.profiles (id, tenant_id, nome, email, role)
    values (
      new.id,
      v_tenant_id,
      v_nome,
      new.email,
      v_role::user_role
    )
    on conflict (id) do nothing;
  else
    -- Cliente final - destino padrao de QUALQUER signup via anon
    -- key, seja qual for o conteudo de user_metadata (inclusive
    -- se alguem tentar mandar role:'admin' por ali - ignorado).
    begin
      v_city_id := nullif(new.raw_user_meta_data->>'delivery_city_id', '')::uuid;
    exception when others then
      v_city_id := null;
    end;

    insert into public.customers (tenant_id, auth_user_id, nome, whatsapp, email, delivery_city_id)
    values (
      v_tenant_id,
      new.id,
      v_nome,
      coalesce(v_whatsapp, ''),
      new.email,
      v_city_id
    )
    on conflict (auth_user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Trigger em si nao muda (mesmo nome, mesmo evento) - recriada
-- por idempotencia/clareza, mesmo padrao da 006 original.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Provisiona profiles (staff) ou customers (cliente) ao criar auth.users. SEGURANCA (migration 033): papel e decidido SO por raw_app_meta_data->>''role'' - campo gravavel apenas via Admin API/service role, NUNCA pelo proprio usuario (signUp()/updateUser() publicos nao alcancam app_metadata em nenhuma hipotese). raw_user_meta_data (inclusive uma eventual chave ''role'' nele) e sempre ignorado para essa decisao - usado so para nome/whatsapp/delivery_city_id, dado de perfil sem risco de autorizacao. Qualquer signup via anon key vira customer, nao importa o payload enviado.';
