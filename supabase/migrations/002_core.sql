-- =====================================================
-- F2 - Nucleo: tenants, perfis, clientes, configuracoes
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- Extensoes ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('admin', 'operador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_mode as enum ('quantitativo', 'disponibilidade');
exception when duplicate_object then null; end $$;

-- ---------- Funcao utilitaria: updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- tenants ----------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tenants_updated on public.tenants;
create trigger trg_tenants_updated
  before update on public.tenants
  for each row execute function public.set_updated_at();

insert into public.tenants (slug, nome)
values ('capua', 'Criatorio Capua')
on conflict (slug) do nothing;

-- ---------- profiles (equipe interna) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  nome text not null,
  email text not null,
  role user_role not null default 'operador',
  pode_aceitar_pedido boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_tenant on public.profiles(tenant_id);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- customers (cliente final) ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null,
  whatsapp text not null,
  email text,
  cidade_entrega text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_tenant on public.customers(tenant_id);
create index if not exists idx_customers_auth on public.customers(auth_user_id);
create index if not exists idx_customers_whatsapp on public.customers(tenant_id, whatsapp);

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------- store_settings (configuracoes da loja) ----------
create table if not exists public.store_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  loja_aberta boolean not null default false,
  mensagem_loja_fechada text default 'A loja esta fechada no momento. Aguarde a abertura do proximo ciclo.',
  permite_autocadastro boolean not null default true,
  valor_minimo_pedido numeric(12,2) not null default 0,
  baixa_estoque_na_reserva boolean not null default true,
  minutos_expiracao_reserva integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_store_settings_updated on public.store_settings;
create trigger trg_store_settings_updated
  before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings (tenant_id)
select id from public.tenants where slug = 'capua'
on conflict (tenant_id) do nothing;

-- ---------- Funcoes auxiliares de autorizacao ----------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
  union all
  select tenant_id from public.customers where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and ativo = true
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo = true
  );
$$;
