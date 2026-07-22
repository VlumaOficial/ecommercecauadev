-- =====================================================
-- VLUMA Keep-Alive Supabase - Padrao v2.1
-- Projeto: Criatorio Capua (ecommerce)
-- =====================================================

create table if not exists public.keepalive_ping (
  id smallint primary key default 1,
  ambiente text not null,
  last_ping timestamptz not null default now(),
  constraint keepalive_ping_singleton check (id = 1)
);

-- Registro unico (ajustar 'DEV' para 'PRD' no ambiente de producao)
insert into public.keepalive_ping (id, ambiente, last_ping)
values (1, 'DEV', now())
on conflict (id) do nothing;

alter table public.keepalive_ping enable row level security;

drop policy if exists "keepalive_anon_select" on public.keepalive_ping;
create policy "keepalive_anon_select"
  on public.keepalive_ping
  for select
  to anon
  using (true);
