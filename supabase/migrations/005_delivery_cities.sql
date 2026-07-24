-- =====================================================
-- F3 - Cidades de entrega
-- Estrutura completa: dropdown de cadastro usa apenas 'nome';
-- ponto de encontro e horario alimentam o pedido (F5/F6).
-- Projeto: Criatorio Capua
-- =====================================================

create table if not exists public.delivery_cities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  uf text,
  ponto_entrega text,
  horario text,
  observacoes text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, nome)
);

create index if not exists idx_delivery_cities_tenant on public.delivery_cities(tenant_id, ordem);

drop trigger if exists trg_delivery_cities_updated on public.delivery_cities;
create trigger trg_delivery_cities_updated
  before update on public.delivery_cities
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.delivery_cities enable row level security;

drop policy if exists "cities_select_public" on public.delivery_cities;
create policy "cities_select_public" on public.delivery_cities
  for select to anon, authenticated using (ativo = true or public.is_staff());

drop policy if exists "cities_staff_write" on public.delivery_cities;
create policy "cities_staff_write" on public.delivery_cities
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Referencia estruturada em customers ----------
alter table public.customers
  add column if not exists delivery_city_id uuid references public.delivery_cities(id) on delete set null;

create index if not exists idx_customers_city on public.customers(delivery_city_id);
