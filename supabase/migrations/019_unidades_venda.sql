-- =====================================================
-- Cadastro de Unidades de Venda (Melhoria 3, decidida em sessao de
-- 01/08/2026): substitui o campo "unidade de venda" de texto livre em
-- products (hoje "und"/"unid"/"unidade" inconsistentes) por um
-- cadastro POR TENANT, selecionavel via combobox no formulario de
-- produto.
--
-- Decisoes fechadas com o usuario antes desta migration:
--   1. Seed inicial: Unidade, Dupla, Cardume, Kg, Litro, Pacote
--      (Dupla/Cardume sao comuns no aquarismo - o lojista complementa
--      depois pelo painel). Semeado pra TODO tenant existente em
--      `tenants` (nao hardcoded 'capua' - este e um produto SaaS,
--      qualquer tenant novo que ja exista na tabela no momento desta
--      migration ganha o mesmo set inicial).
--   2. O DROP da coluna antiga `products.unidade_venda` (texto livre)
--      fica **fora** desta migration, de proposito - ver
--      020_drop_products_unidade_venda_text.sql, aplicadaso depois
--      que o usuario confirmar que os produtos funcionam com a nova
--      selecao. Esta migration so ADICIONA `unidade_venda_id` e faz o
--      backfill; a coluna antiga continua existindo e sendo ignorada
--      pelas RPCs a partir daqui.
--   3. Fallback: produto com `unidade_venda` vazio/nulo (nao deveria
--      acontecer, a coluna e NOT NULL DEFAULT 'unidade' desde a 003,
--      mas defensivo) recebe a unidade "Unidade" antes do
--      `set not null` em `unidade_venda_id`.
--   4. RPCs `criar_produto_com_variacoes`/`atualizar_produto_com_variacoes`
--      revisadas aqui mesmo (create or replace) pra trocar o parametro
--      `unidade_venda` (text) por `unidade_venda_id` (uuid), validando
--      que a unidade pertence ao tenant do usuario - mesmo padrao ja
--      usado pra `category_id` nas duas funcoes (SECURITY DEFINER
--      ignora RLS, entao a checagem de tenant precisa estar no corpo
--      da funcao).
--
-- Isolamento multi-tenant: segue o padrao pos-014 (select_authenticated
-- com tenant_id = current_tenant_id(), staff_write exige is_staff() e
-- tenant_id = current_tenant_id()). Sem policy pra `anon` de proposito -
-- a vitrine publica ainda nao existe; quando for construida, entra a
-- policy `_select_anon` como ja documentado em ESCOPO_PROJETO.md §2
-- "Opcao C" pra outras tabelas de catalogo.
--
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. Tabela ----------
create table if not exists public.unidades_venda (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, nome)
);

create index if not exists idx_unidades_venda_tenant on public.unidades_venda(tenant_id, ordem);

drop trigger if exists trg_unidades_venda_updated on public.unidades_venda;
create trigger trg_unidades_venda_updated
  before update on public.unidades_venda
  for each row execute function public.set_updated_at();

alter table public.unidades_venda enable row level security;

drop policy if exists "unidades_venda_select_authenticated" on public.unidades_venda;
create policy "unidades_venda_select_authenticated" on public.unidades_venda
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and (ativo = true or public.is_staff()));

drop policy if exists "unidades_venda_staff_write" on public.unidades_venda;
create policy "unidades_venda_staff_write" on public.unidades_venda
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- ---------- 2. Seed: um set inicial por tenant ja existente ----------
insert into public.unidades_venda (tenant_id, nome, ordem)
select t.id, u.nome, u.ordem
from public.tenants t
cross join (values
  ('Unidade', 0),
  ('Dupla', 1),
  ('Cardume', 2),
  ('Kg', 3),
  ('Litro', 4),
  ('Pacote', 5)
) as u(nome, ordem)
on conflict (tenant_id, nome) do nothing;

-- ---------- 3. products.unidade_venda_id (coluna nova, nullable por enquanto) ----------
alter table public.products
  add column if not exists unidade_venda_id uuid references public.unidades_venda(id);

-- ---------- 4. Backfill: cria unidade pra qualquer texto livre que ainda nao bate (case-insensitive) com nenhuma unidade existente ----------
-- Preserva o que o lojista ja tinha digitado (nao normaliza nem
-- descarta) - se ja existir "Kg" e um produto tiver "kg" (minusculo),
-- NAO cria uma segunda linha "kg": o backfill do passo 5 casa por
-- lower() e reaproveita a que ja existe.
insert into public.unidades_venda (tenant_id, nome)
select distinct p.tenant_id, p.unidade_venda
from public.products p
where p.unidade_venda is not null and btrim(p.unidade_venda) <> ''
  and not exists (
    select 1 from public.unidades_venda u
    where u.tenant_id = p.tenant_id and lower(u.nome) = lower(p.unidade_venda)
  )
on conflict (tenant_id, nome) do nothing;

-- ---------- 5. Liga cada produto a unidade correspondente (case-insensitive) ----------
update public.products p
set unidade_venda_id = u.id
from public.unidades_venda u
where u.tenant_id = p.tenant_id
  and lower(u.nome) = lower(p.unidade_venda)
  and p.unidade_venda_id is null;

-- ---------- 6. Fallback: produto com unidade_venda vazio/nulo (defensivo - a coluna e NOT NULL desde a 003, mas nao custa garantir) ou que por algum motivo nao casou no passo 5, cai em "Unidade" ----------
update public.products p
set unidade_venda_id = (
  select u.id from public.unidades_venda u
  where u.tenant_id = p.tenant_id and u.nome = 'Unidade'
  limit 1
)
where p.unidade_venda_id is null;

-- ---------- 7. Agora sim, obrigatorio ----------
alter table public.products
  alter column unidade_venda_id set not null;

-- ---------- 8. criar_produto_com_variacoes: unidade_venda -> unidade_venda_id ----------
-- Mesma assinatura/garantias da 017 (tenant, atomicidade, SKU
-- automatico, mensagens amigaveis) - so troca o campo de unidade e
-- adiciona a validacao de tenant pra ele, no mesmo padrao ja usado
-- pra category_id logo acima.
create or replace function public.criar_produto_com_variacoes(
  p_produto jsonb,
  p_variacoes jsonb
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produto public.products;
  v_categoria_ok boolean;
  v_unidade_ok boolean;
  v_item jsonb;
  v_nome_variacao text;
  v_sku text;
  v_skus_em_uso text[] := '{}';
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  if p_variacoes is null or jsonb_array_length(p_variacoes) = 0 then
    raise exception 'Adicione pelo menos uma variação para o produto.';
  end if;

  select exists (
    select 1 from public.categories
    where id = (p_produto->>'category_id')::uuid
      and tenant_id = public.current_tenant_id()
  ) into v_categoria_ok;

  if not v_categoria_ok then
    raise exception 'Categoria não encontrada.';
  end if;

  select exists (
    select 1 from public.unidades_venda
    where id = (p_produto->>'unidade_venda_id')::uuid
      and tenant_id = public.current_tenant_id()
  ) into v_unidade_ok;

  if not v_unidade_ok then
    raise exception 'Unidade de venda não encontrada.';
  end if;

  begin
    insert into public.products (
      category_id, nome, slug, descricao, unidade_venda_id, destaque, ativo, codigo, codigo_visivel
    )
    values (
      (p_produto->>'category_id')::uuid,
      p_produto->>'nome',
      p_produto->>'slug',
      nullif(p_produto->>'descricao', ''),
      (p_produto->>'unidade_venda_id')::uuid,
      coalesce((p_produto->>'destaque')::boolean, false),
      coalesce((p_produto->>'ativo')::boolean, true),
      p_produto->>'codigo',
      coalesce((p_produto->>'codigo_visivel')::boolean, false)
    )
    returning * into v_produto;
  exception
    when unique_violation then
      declare
        v_constraint text;
      begin
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'idx_products_codigo' then
          raise exception 'Já existe um produto com este código. Escolha outro.';
        else
          raise exception 'Já existe um produto com esse nome. Ajuste o nome.';
        end if;
      end;
  end;

  for v_item in select * from jsonb_array_elements(p_variacoes)
  loop
    v_nome_variacao := coalesce(nullif(v_item->>'nome', ''), 'Padrao');
    v_sku := nullif(v_item->>'sku', '');
    if v_sku is null then
      v_sku := public.gerar_sku_variacao(v_produto.codigo, v_nome_variacao, v_skus_em_uso);
    end if;
    v_skus_em_uso := array_append(v_skus_em_uso, v_sku);

    begin
      insert into public.product_variants (
        product_id, nome, sku, preco, preco_promocional, modo_estoque, saldo_estoque, quantidade_minima
      )
      values (
        v_produto.id,
        v_nome_variacao,
        v_sku,
        (v_item->>'preco')::numeric,
        nullif(v_item->>'preco_promocional', '')::numeric,
        coalesce((v_item->>'modo_estoque')::stock_mode, 'quantitativo'),
        coalesce((v_item->>'saldo_estoque')::integer, 0),
        coalesce((v_item->>'quantidade_minima')::integer, 1)
      );
    exception
      when unique_violation then
        raise exception 'Já existe uma variação com este SKU. Ajuste o SKU.';
      when check_violation then
        declare
          v_constraint text;
        begin
          get stacked diagnostics v_constraint = constraint_name;
          raise exception '%', public.mensagem_erro_variacao(v_constraint);
        end;
    end;
  end loop;

  return v_produto;
end;
$$;

-- ---------- 9. atualizar_produto_com_variacoes: unidade_venda -> unidade_venda_id ----------
-- Mesma logica da 017 (sync de variacoes por diff, soft delete das
-- removidas, codigo nunca no payload) - so troca o campo de unidade e
-- adiciona a mesma validacao de tenant do passo 8.
create or replace function public.atualizar_produto_com_variacoes(
  p_product_id uuid,
  p_produto jsonb,
  p_variacoes jsonb
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produto public.products;
  v_categoria_ok boolean;
  v_unidade_ok boolean;
  v_item jsonb;
  v_variant_id uuid;
  v_nome_variacao text;
  v_sku text;
  v_skus_em_uso text[];
  v_ids_no_payload uuid[] := '{}';
  v_ativas_restantes integer;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  select * into v_produto
  from public.products
  where id = p_product_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'Produto não encontrado.';
  end if;

  if p_variacoes is null or jsonb_array_length(p_variacoes) = 0 then
    raise exception 'Adicione pelo menos uma variação para o produto.';
  end if;

  select exists (
    select 1 from public.categories
    where id = (p_produto->>'category_id')::uuid
      and tenant_id = public.current_tenant_id()
  ) into v_categoria_ok;

  if not v_categoria_ok then
    raise exception 'Categoria não encontrada.';
  end if;

  select exists (
    select 1 from public.unidades_venda
    where id = (p_produto->>'unidade_venda_id')::uuid
      and tenant_id = public.current_tenant_id()
  ) into v_unidade_ok;

  if not v_unidade_ok then
    raise exception 'Unidade de venda não encontrada.';
  end if;

  -- ---------- dados do produto (codigo NUNCA entra aqui - imutavel) ----------
  begin
    update public.products
    set
      category_id = (p_produto->>'category_id')::uuid,
      nome = p_produto->>'nome',
      slug = p_produto->>'slug',
      descricao = nullif(p_produto->>'descricao', ''),
      unidade_venda_id = (p_produto->>'unidade_venda_id')::uuid,
      destaque = coalesce((p_produto->>'destaque')::boolean, false),
      ativo = coalesce((p_produto->>'ativo')::boolean, true),
      codigo_visivel = coalesce((p_produto->>'codigo_visivel')::boolean, false)
    where id = p_product_id
    returning * into v_produto;
  exception
    when unique_violation then
      raise exception 'Já existe um produto com esse nome. Ajuste o nome.';
  end;

  -- ---------- SKUs ja em uso por este produto (ponto de partida) ----------
  select coalesce(array_agg(sku) filter (where sku is not null), '{}')
  into v_skus_em_uso
  from public.product_variants
  where product_id = p_product_id;

  -- ---------- cria ou atualiza cada variacao do payload ----------
  for v_item in select * from jsonb_array_elements(p_variacoes)
  loop
    v_variant_id := nullif(v_item->>'id', '')::uuid;
    v_nome_variacao := coalesce(nullif(v_item->>'nome', ''), 'Padrao');

    if v_variant_id is not null then
      begin
        update public.product_variants
        set
          nome = v_nome_variacao,
          sku = coalesce(nullif(v_item->>'sku', ''), product_variants.sku),
          preco = (v_item->>'preco')::numeric,
          preco_promocional = nullif(v_item->>'preco_promocional', '')::numeric,
          modo_estoque = coalesce((v_item->>'modo_estoque')::stock_mode, modo_estoque),
          saldo_estoque = coalesce((v_item->>'saldo_estoque')::integer, saldo_estoque),
          quantidade_minima = coalesce((v_item->>'quantidade_minima')::integer, quantidade_minima),
          ativo = true
        where id = v_variant_id and product_id = p_product_id;
      exception
        when unique_violation then
          raise exception 'Já existe uma variação com este SKU. Ajuste o SKU.';
        when check_violation then
          declare
            v_constraint text;
          begin
            get stacked diagnostics v_constraint = constraint_name;
            raise exception '%', public.mensagem_erro_variacao(v_constraint);
          end;
      end;

      if not found then
        raise exception 'Variação não encontrada.';
      end if;

      v_ids_no_payload := array_append(v_ids_no_payload, v_variant_id);
    else
      v_sku := nullif(v_item->>'sku', '');
      if v_sku is null then
        v_sku := public.gerar_sku_variacao(v_produto.codigo, v_nome_variacao, v_skus_em_uso);
      end if;
      v_skus_em_uso := array_append(v_skus_em_uso, v_sku);

      begin
        insert into public.product_variants (
          product_id, nome, sku, preco, preco_promocional, modo_estoque, saldo_estoque, quantidade_minima
        )
        values (
          p_product_id,
          v_nome_variacao,
          v_sku,
          (v_item->>'preco')::numeric,
          nullif(v_item->>'preco_promocional', '')::numeric,
          coalesce((v_item->>'modo_estoque')::stock_mode, 'quantitativo'),
          coalesce((v_item->>'saldo_estoque')::integer, 0),
          coalesce((v_item->>'quantidade_minima')::integer, 1)
        )
        returning id into v_variant_id;
      exception
        when unique_violation then
          raise exception 'Já existe uma variação com este SKU. Ajuste o SKU.';
        when check_violation then
          declare
            v_constraint text;
          begin
            get stacked diagnostics v_constraint = constraint_name;
            raise exception '%', public.mensagem_erro_variacao(v_constraint);
          end;
      end;

      v_ids_no_payload := array_append(v_ids_no_payload, v_variant_id);
    end if;
  end loop;

  -- ---------- soft delete das variacoes que sairam do payload ----------
  update public.product_variants
  set ativo = false
  where product_id = p_product_id
    and ativo = true
    and id <> all (v_ids_no_payload);

  -- ---------- garante pelo menos 1 variacao ativa ----------
  select count(*) into v_ativas_restantes
  from public.product_variants
  where product_id = p_product_id and ativo = true;

  if v_ativas_restantes = 0 then
    raise exception 'O produto precisa ter pelo menos uma variação ativa.';
  end if;

  return v_produto;
end;
$$;
