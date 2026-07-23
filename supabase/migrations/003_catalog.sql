-- =====================================================
-- F2 - Catalogo: categorias, subcategorias, campos
--      dinamicos, produtos, imagens, historico de preco
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- Enum: tipo de campo dinamico ----------
do $$ begin
  create type field_type as enum ('texto', 'numero', 'lista', 'booleano', 'data');
exception when duplicate_object then null; end $$;

-- ---------- categories (nivel 1) ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  slug text not null,
  descricao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_categories_tenant on public.categories(tenant_id, ordem);

drop trigger if exists trg_categories_updated on public.categories;
create trigger trg_categories_updated
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------- subcategories (nivel 2 - dona dos campos dinamicos) ----------
create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  nome text not null,
  slug text not null,
  descricao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_subcategories_category on public.subcategories(category_id, ordem);
create index if not exists idx_subcategories_tenant on public.subcategories(tenant_id);

drop trigger if exists trg_subcategories_updated on public.subcategories;
create trigger trg_subcategories_updated
  before update on public.subcategories
  for each row execute function public.set_updated_at();

-- ---------- subcategory_fields (definicao dos campos dinamicos) ----------
create table if not exists public.subcategory_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subcategory_id uuid not null references public.subcategories(id) on delete cascade,
  chave text not null,
  rotulo text not null,
  tipo field_type not null default 'texto',
  opcoes jsonb,
  obrigatorio boolean not null default false,
  usar_em_filtro boolean not null default false,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subcategory_id, chave)
);

create index if not exists idx_subcategory_fields_sub on public.subcategory_fields(subcategory_id, ordem);

drop trigger if exists trg_subcategory_fields_updated on public.subcategory_fields;
create trigger trg_subcategory_fields_updated
  before update on public.subcategory_fields
  for each row execute function public.set_updated_at();

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subcategory_id uuid not null references public.subcategories(id) on delete restrict,
  nome text not null,
  slug text not null,
  descricao text,
  preco numeric(12,2) not null default 0,
  unidade_venda text not null default 'unidade',
  quantidade_minima integer not null default 1,
  modo_estoque stock_mode not null default 'quantitativo',
  saldo_estoque integer not null default 0,
  disponivel boolean not null default true,
  destaque boolean not null default false,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  constraint chk_quantidade_minima check (quantidade_minima >= 1),
  constraint chk_saldo_estoque check (saldo_estoque >= 0),
  constraint chk_preco check (preco >= 0)
);

create index if not exists idx_products_tenant on public.products(tenant_id, ativo);
create index if not exists idx_products_subcategory on public.products(subcategory_id, ordem);
create index if not exists idx_products_slug on public.products(tenant_id, slug);
create index if not exists idx_products_destaque on public.products(tenant_id, destaque) where destaque = true;

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------- product_field_values (valores dos campos dinamicos) ----------
create table if not exists public.product_field_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  field_id uuid not null references public.subcategory_fields(id) on delete cascade,
  valor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, field_id)
);

create index if not exists idx_pfv_product on public.product_field_values(product_id);
create index if not exists idx_pfv_field on public.product_field_values(field_id);

drop trigger if exists trg_pfv_updated on public.product_field_values;
create trigger trg_pfv_updated
  before update on public.product_field_values
  for each row execute function public.set_updated_at();

-- ---------- product_images ----------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  principal boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_images_product on public.product_images(product_id, ordem);
create unique index if not exists idx_product_images_principal
  on public.product_images(product_id) where principal = true;

-- ---------- product_price_history ----------
create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  preco_anterior numeric(12,2),
  preco_novo numeric(12,2) not null,
  alterado_por uuid references auth.users(id) on delete set null,
  alterado_em timestamptz not null default now()
);

create index if not exists idx_price_history_product on public.product_price_history(product_id, alterado_em desc);

-- ---------- Trigger: registrar historico de preco ----------
create or replace function public.log_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.product_price_history (tenant_id, product_id, preco_anterior, preco_novo, alterado_por)
    values (new.tenant_id, new.id, null, new.preco, auth.uid());
  elsif (tg_op = 'UPDATE' and new.preco is distinct from old.preco) then
    insert into public.product_price_history (tenant_id, product_id, preco_anterior, preco_novo, alterado_por)
    values (new.tenant_id, new.id, old.preco, new.preco, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_price_history on public.products;
create trigger trg_products_price_history
  after insert or update of preco on public.products
  for each row execute function public.log_price_change();
