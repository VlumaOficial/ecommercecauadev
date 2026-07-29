-- =====================================================
-- Catalogo v2: categorias em arvore + atributos + variacoes (SKU)
-- Substitui categories/subcategories/subcategory_fields (2 niveis
-- fixos) por uma modelagem de mercado (Shopify/Cobasi-like):
--   - categories: arvore via parent_id (N niveis)
--   - category_attributes: ficha tecnica/filtros por categoria
--   - product_variants: SKU (preco, estoque, promo vivem aqui)
-- RASCUNHO - NAO APLICADO. Ambiente de DEV sem dados reais de
-- catalogo, entao recriamos em vez de migrar dados linha a linha.
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. categories vira arvore ----------
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete cascade;

create index if not exists idx_categories_parent on public.categories(parent_id, ordem);

-- Nota: unique(tenant_id, slug) already existente continua valendo
-- pra ARVORE INTEIRA (slug unico no tenant, nao por parent). Padrao
-- mais simples e mais parecido com Shopify (handle unico na loja).
-- Se quiser slug unico só dentro do parent, troca por
-- unique (tenant_id, parent_id, slug) — decisao de produto, nao tecnica.

-- DECISAO DE PRODUTO (nao tecnica): sem guarda contra ciclos no banco.
-- A validacao anti-ciclo (nao deixar escolher como pai uma categoria
-- que e descendente dela mesma) fica a cargo da APLICACAO, no form
-- do CRUD de Categorias (mesmo padrao do CRUD de Cidades) — o
-- seletor de categoria-pai deve excluir a propria categoria e toda
-- a sua subarvore ao editar.

-- ---------- 2. category_attributes (substitui subcategory_fields) ----------
-- Reaproveita o enum field_type; renomeia 'lista' -> 'selecao' pra
-- bater com a nomenclatura pedida (texto/numero/selecao/booleano).
-- 'data' fica no enum (nao usado agora, sem custo manter).
alter type field_type rename value 'lista' to 'selecao';

create table if not exists public.category_attributes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  chave text not null,
  rotulo text not null,
  tipo field_type not null default 'texto',
  opcoes jsonb,              -- usado quando tipo = 'selecao'
  obrigatorio boolean not null default false,
  usar_em_filtro boolean not null default false,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, chave)
);

create index if not exists idx_category_attributes_category
  on public.category_attributes(category_id, ordem);

drop trigger if exists trg_category_attributes_updated on public.category_attributes;
create trigger trg_category_attributes_updated
  before update on public.category_attributes
  for each row execute function public.set_updated_at();

-- ---------- 3. products: perde preco/estoque, ganha category_id ----------
-- Precisa cair ANTES do drop das colunas de preco/estoque: o trigger
-- antigo depende de products.preco (senao da erro 2BP01 ao tentar
-- dropar a coluna).
drop trigger if exists trg_products_price_history on public.products;
drop function if exists public.log_price_change();

alter table public.products rename column subcategory_id to category_id;
alter table public.products drop constraint if exists products_subcategory_id_fkey;
alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete restrict;

alter table public.products drop constraint if exists chk_preco;
alter table public.products drop constraint if exists chk_saldo_estoque;
alter table public.products drop constraint if exists chk_quantidade_minima;

alter table public.products drop column if exists preco;
alter table public.products drop column if exists saldo_estoque;
alter table public.products drop column if exists modo_estoque;
alter table public.products drop column if exists quantidade_minima;
-- unidade_venda fica no produto (aplica a todas as variacoes, ex.:
-- "kg", "unidade"). Se no futuro variar por SKU, move pra variant.

-- disponivel (flag manual) sai: "esgotado" passa a ser DERIVADO da
-- soma de saldo_estoque das variacoes (item 5). destaque CONTINUA —
-- e curadoria manual do staff, nao um status calculado.
alter table public.products drop column if exists disponivel;

-- ---------- 4. product_variants (SKU) ----------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  nome text not null default 'Padrao',   -- rotulo: "Pequeno", "1kg", etc.
  sku text,
  preco numeric(12,2) not null default 0,
  preco_promocional numeric(12,2),
  modo_estoque stock_mode not null default 'quantitativo',
  saldo_estoque integer not null default 0,
  quantidade_minima integer not null default 1,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku),
  constraint chk_variant_preco check (preco >= 0),
  constraint chk_variant_preco_promo
    check (preco_promocional is null or (preco_promocional >= 0 and preco_promocional < preco)),
  constraint chk_variant_estoque check (saldo_estoque >= 0),
  constraint chk_variant_qtd_min check (quantidade_minima >= 1)
);

create index if not exists idx_product_variants_product
  on public.product_variants(product_id, ordem);

drop trigger if exists trg_product_variants_updated on public.product_variants;
create trigger trg_product_variants_updated
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Produto simples = 1 variant (criada junto no cadastro, nome
-- default 'Padrao'); produto com tamanhos = N variants. Nao ha
-- constraint de "pelo menos 1 variant" no banco — garantido na
-- camada de aplicacao (o form de produto sempre cria/edita >=1).

-- ---------- 5. product_field_values -> product_attribute_values ----------
alter table public.product_field_values rename to product_attribute_values;
alter table public.product_attribute_values rename column field_id to attribute_id;
alter table public.product_attribute_values
  drop constraint if exists product_field_values_field_id_fkey;
alter table public.product_attribute_values
  add constraint product_attribute_values_attribute_id_fkey
  foreign key (attribute_id) references public.category_attributes(id) on delete cascade;

-- ---------- 6. subcategories / subcategory_fields somem ----------
-- Sem dados reais de catalogo em DEV: dropa em vez de migrar linha
-- a linha. subcategory_fields ja foi substituida (passo 2) e
-- desacoplada de product_field_values (passo 5) antes deste drop.
drop table if exists public.subcategory_fields cascade;
drop table if exists public.subcategories cascade;

-- ---------- 7. product_price_history passa a rastrear a VARIANT ----------
-- Preco agora vive na variant, entao o historico precisa saber qual
-- SKU mudou de preco. Mantem product_id (denormalizado, útil pra
-- listar historico do produto inteiro sem join) + variant_id (fonte
-- da verdade).
alter table public.product_price_history
  add column if not exists variant_id uuid references public.product_variants(id) on delete cascade;

-- (trigger/funcao antigos ja foram derrubados no passo 3, antes do
-- drop das colunas de preco/estoque de products)

create or replace function public.log_variant_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.product_price_history (tenant_id, product_id, variant_id, preco_anterior, preco_novo, alterado_por)
    values (new.tenant_id, new.product_id, new.id, null, new.preco, auth.uid());
  elsif (tg_op = 'UPDATE' and new.preco is distinct from old.preco) then
    insert into public.product_price_history (tenant_id, product_id, variant_id, preco_anterior, preco_novo, alterado_por)
    values (new.tenant_id, new.product_id, new.id, old.preco, new.preco, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_variants_price_history on public.product_variants;
create trigger trg_product_variants_price_history
  after insert or update of preco on public.product_variants
  for each row execute function public.log_variant_price_change();

-- product_images: fica como esta, ligada a product_id (fotos
-- compartilhadas entre variacoes). Per-variant image e extensao
-- futura (Shopify suporta; nao pedido agora).

-- ---------- 8. Status derivados (NAO armazenados) ----------
-- Exemplos de uso na camada de query/app — nao criar colunas:
--   esgotado:      coalesce(sum(v.saldo_estoque) filter (where v.ativo), 0) = 0
--   em_promocao:   exists variant ativa com preco_promocional < preco
--   novidade:      products.created_at > now() - interval '30 days'
-- View opcional de conveniencia (nao obrigatoria, so um exemplo):
create or replace view public.products_com_status as
select
  p.*,
  coalesce(sum(v.saldo_estoque) filter (where v.ativo), 0) as estoque_total,
  coalesce(sum(v.saldo_estoque) filter (where v.ativo), 0) = 0 as esgotado,
  bool_or(v.ativo and v.preco_promocional is not null and v.preco_promocional < v.preco) as em_promocao,
  min(v.preco) filter (where v.ativo) as preco_a_partir_de,
  p.created_at > now() - interval '30 days' as novidade
from public.products p
left join public.product_variants v on v.product_id = p.id
group by p.id;

-- ---------- 9. RLS das tabelas novas/renomeadas ----------
alter table public.category_attributes    enable row level security;
alter table public.product_variants       enable row level security;

drop policy if exists "category_attributes_select_public" on public.category_attributes;
create policy "category_attributes_select_public" on public.category_attributes
  for select to anon, authenticated using (ativo = true or public.is_staff());

drop policy if exists "category_attributes_staff_write" on public.category_attributes;
create policy "category_attributes_staff_write" on public.category_attributes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "product_variants_select_public" on public.product_variants;
create policy "product_variants_select_public" on public.product_variants
  for select to anon, authenticated using (ativo = true or public.is_staff());

drop policy if exists "product_variants_staff_write" on public.product_variants;
create policy "product_variants_staff_write" on public.product_variants
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Politicas antigas de subcategories/subcategory_fields somem junto
-- com as tabelas (drop cascade no passo 6). categories_*,
-- products_*, pfv_*(agora sobre product_attribute_values), images_*
-- e price_history_* continuam validas sem alteracao — so revisar
-- nomes internos que citavam "subcategoria" nos comentarios/policies
-- se quiser manter consistencia semantica (nao e obrigatorio).
