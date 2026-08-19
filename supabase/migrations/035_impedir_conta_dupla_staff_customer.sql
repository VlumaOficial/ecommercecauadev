-- =====================================================
-- Fase 2, incremento 2 (Contas de cliente) — defesa em
-- profundidade pro isolamento de papéis (REGRAS_DE_NEGOCIO.md
-- §1/§14: "cliente nunca é staff e vice-versa"), decidida
-- junto do pacote aprovado em 18/08/2026.
--
-- Contexto: o caso "duas contas DIFERENTES (uma staff, uma
-- cliente) compartilhando o mesmo e-mail" já é estruturalmente
-- impossível hoje — `auth.users.email` é único por padrão no
-- projeto Supabase, e `profiles.id`/`customers.auth_user_id`
-- são 1:1 com `auth.users.id`, então não dá pra ter dois
-- `auth.users` diferentes com o mesmo e-mail virando um staff
-- e um cliente separados (`/cadastro` já trata esse erro como
-- "e-mail já cadastrado").
--
-- O que NÃO estava fechado: a MESMA conta (mesmo
-- `auth.users.id`) acumular uma linha em `profiles` E uma em
-- `customers` ao mesmo tempo. `handle_new_user` (migration 006,
-- endurecida na 033) nunca faz isso — insere em só uma das
-- duas, nunca as duas — mas nada no banco impede um INSERT
-- manual (SQL Editor/service role, o caminho privilegiado de
-- criar staff) de criar essa sobreposição por engano (ex.:
-- inserir staff pra um `auth_user_id` que já é cliente, ou
-- vice-versa). Não é risco externo (só alcançável por quem já
-- tem acesso privilegiado), é erro operacional possível — as 2
-- triggers abaixo fecham essa lacuna.
--
-- Duas triggers `BEFORE INSERT`, uma em cada tabela, cada uma
-- checando a outra: tentar inserir em `profiles` um `id` que já
-- existe em `customers.auth_user_id` (ou vice-versa) levanta
-- exceção e a transação inteira desfaz — nunca deixa a
-- sobreposição existir, nem por um instante. `SECURITY DEFINER`
-- pra garantir que a checagem cruzada funcione independente do
-- RLS de quem está inserindo (mesmo padrão já usado em
-- `handle_new_user`/`set_category_ativo_cascade`).
--
-- Escopo deliberadamente limitado a INSERT: `profiles.id` e
-- `customers.auth_user_id` são PK/coluna única referenciando
-- `auth.users(id)` — um UPDATE que mudasse esses valores pra
-- apontar pra outro usuário já existente seria um cenário
-- extremamente incomum (trocar a identidade de uma linha já
-- existente), fora do vetor real que este pacote decidiu
-- cobrir. Não tratado aqui; registrar como limitação conhecida.
--
-- Não interfere com o fluxo normal de `handle_new_user`: ele só
-- insere numa tabela por vez para um `auth.users` recém-criado
-- (nunca nas duas), então as triggers abaixo nunca disparam no
-- caminho comum — só quando alguém tenta criar a sobreposição
-- de propósito ou por engano.
-- =====================================================

create or replace function public.impedir_profile_se_ja_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.customers where auth_user_id = new.id) then
    raise exception 'Este usuario ja possui cadastro de cliente - nao pode virar equipe (staff) sem antes remover o cadastro de cliente.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_impedir_conta_dupla on public.profiles;
create trigger trg_profiles_impedir_conta_dupla
  before insert on public.profiles
  for each row execute function public.impedir_profile_se_ja_customer();

comment on function public.impedir_profile_se_ja_customer() is
  'Guarda de isolamento de papeis (REGRAS_DE_NEGOCIO.md §1/§14): recusa inserir em profiles se o mesmo auth.users.id ja existe em customers. So alcancavel via INSERT manual privilegiado (SQL Editor/service role) - handle_new_user nunca insere nas duas tabelas para o mesmo usuario.';


create or replace function public.impedir_customer_se_ja_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = new.auth_user_id) then
    raise exception 'Este usuario ja e equipe (staff) - nao pode virar cliente sem antes remover o cadastro de equipe.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_customers_impedir_conta_dupla on public.customers;
create trigger trg_customers_impedir_conta_dupla
  before insert on public.customers
  for each row execute function public.impedir_customer_se_ja_staff();

comment on function public.impedir_customer_se_ja_staff() is
  'Guarda de isolamento de papeis (REGRAS_DE_NEGOCIO.md §1/§14): recusa inserir em customers se o mesmo auth.users.id ja existe em profiles. So alcancavel via INSERT manual privilegiado (SQL Editor/service role) - handle_new_user nunca insere nas duas tabelas para o mesmo usuario.';
