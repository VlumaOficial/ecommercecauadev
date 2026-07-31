-- =====================================================
-- Codigo do Produto: identificacao/referencia por produto, distinta
-- do SKU (product_variants.sku, por variacao/estoque).
-- Decisao de produto: ver ESCOPO_PROJETO.md #18 e REGRAS_DE_NEGOCIO.md §4.6.
--
-- Isolamento multi-tenant: toda unicidade (prefixo de categoria,
-- codigo de produto) e por tenant_id -- dois tenants podem ter
-- prefixos/codigos identicos sem conflito. As RPCs desta migration
-- fazem checagem explicita de "tenant_id = current_tenant_id()" antes
-- de ler/gravar: sendo SECURITY DEFINER, elas ignoram RLS, entao a
-- checagem de tenant precisa estar no corpo da funcao, nao so na
-- policy da tabela.
--
-- Mensagens de erro voltadas ao usuario (raise exception aqui) seguem
-- o padrao registrado em REGRAS_DE_NEGOCIO.md §9: portugues claro,
-- orienta a acao, zero jargao tecnico. Ver ESCOPO_PROJETO.md §2
-- "Padrao de mensagens de erro" para o catalogo completo desta feature.
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. categories.prefixo_codigo ----------
alter table public.categories
  add column if not exists prefixo_codigo text;

-- Unico POR TENANT: dois tenants podem usar o mesmo prefixo.
create unique index if not exists idx_categories_prefixo_codigo
  on public.categories(tenant_id, prefixo_codigo)
  where prefixo_codigo is not null;

-- ---------- 2. products.codigo / codigo_visivel ----------
alter table public.products
  add column if not exists codigo text,
  add column if not exists codigo_visivel boolean not null default false;

-- Unico POR TENANT. Coluna fica nullable no banco (nao "not null"):
-- a aplicacao sempre preenche na criacao (RPC ou valor manual) - nunca
-- fica null vindo do painel.
create unique index if not exists idx_products_codigo
  on public.products(tenant_id, codigo)
  where codigo is not null;

-- Imutabilidade: codigo nunca muda depois de gravado, mesmo que o
-- produto mude de categoria (decisao #18).
create or replace function public.prevent_codigo_change()
returns trigger
language plpgsql
as $$
begin
  if old.codigo is not null and new.codigo is distinct from old.codigo then
    raise exception 'O código do produto não pode ser alterado depois de criado.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_codigo_imutavel on public.products;
create trigger trg_products_codigo_imutavel
  before update on public.products
  for each row execute function public.prevent_codigo_change();

-- ---------- 3. Sequencia de codigo POR CATEGORIA ----------
-- Tabela contadora (1 linha por categoria) + RPC de upsert atomico.
-- Rejeitadas: (a) sequence do Postgres por categoria -- exigiria SQL
-- dinamico (CREATE SEQUENCE) a cada categoria nova, dificil de
-- gerenciar/dropar; (b) MAX(numero) extraido de codigos existentes --
-- fragil contra codigos manuais fora do padrao PREFIXO-NNNN (que o
-- modo manual permite de proposito).
create table if not exists public.category_code_sequences (
  category_id uuid primary key references public.categories(id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  ultimo_numero integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.category_code_sequences enable row level security;

drop policy if exists "category_code_sequences_staff_all" on public.category_code_sequences;
create policy "category_code_sequences_staff_all" on public.category_code_sequences
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- 4. RPC: reserva o proximo codigo (modo automatico) ----------
-- Atomica (insert...on conflict e atomico por linha).
create or replace function public.gerar_codigo_produto(p_category_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefixo text;
  v_numero integer;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  -- Checagem explicita de tenant (ver nota de isolamento no topo do
  -- arquivo): sem isso, um category_id de outro tenant seria aceito.
  select prefixo_codigo into v_prefixo
  from public.categories
  where id = p_category_id
    and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'Categoria não encontrada.';
  end if;

  if v_prefixo is null or v_prefixo = '' then
    raise exception 'Esta categoria ainda não tem um prefixo de código. Abra o cadastro da categoria e salve para gerá-lo.';
  end if;

  insert into public.category_code_sequences (category_id, ultimo_numero)
  values (p_category_id, 1)
  on conflict (category_id)
  do update set ultimo_numero = category_code_sequences.ultimo_numero + 1,
                updated_at = now()
  returning ultimo_numero into v_numero;

  return v_prefixo || '-' || lpad(v_numero::text, 4, '0');
end;
$$;

-- ---------- 5. RPC: cria produto + variacoes numa transacao so ----------
-- Garante o invariante "produto sempre nasce com >=1 variacao" (nao
-- existe constraint de banco pra isso -- ver comentario na 009) sem
-- deixar produto orfao se o insert de variacoes falhar: se qualquer
-- excecao escapar da funcao, TUDO que ela fez ate ali (inclusive o
-- insert do produto) e desfeito junto, porque a funcao roda dentro da
-- mesma transacao da chamada.
-- Tambem valida que a categoria pertence ao tenant do usuario (mesma
-- razao da RPC acima) e traduz violacoes de constraint em mensagens
-- amigaveis, pra nao vazar nome de constraint/tabela pro usuario final.
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

  begin
    insert into public.products (
      category_id, nome, slug, descricao, unidade_venda, destaque, ativo, codigo, codigo_visivel
    )
    values (
      (p_produto->>'category_id')::uuid,
      p_produto->>'nome',
      p_produto->>'slug',
      nullif(p_produto->>'descricao', ''),
      coalesce(nullif(p_produto->>'unidade_venda', ''), 'unidade'),
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

  begin
    insert into public.product_variants (
      product_id, nome, sku, preco, preco_promocional, modo_estoque, saldo_estoque, quantidade_minima
    )
    select
      v_produto.id,
      coalesce(nullif(item->>'nome', ''), 'Padrao'),
      nullif(item->>'sku', ''),
      (item->>'preco')::numeric,
      nullif(item->>'preco_promocional', '')::numeric,
      coalesce((item->>'modo_estoque')::stock_mode, 'quantitativo'),
      coalesce((item->>'saldo_estoque')::integer, 0),
      coalesce((item->>'quantidade_minima')::integer, 1)
    from jsonb_array_elements(p_variacoes) as item;
  exception
    when unique_violation then
      raise exception 'Já existe uma variação com este SKU. Ajuste o SKU.';
    when check_violation then
      declare
        v_constraint text;
      begin
        get stacked diagnostics v_constraint = constraint_name;
        case v_constraint
          when 'chk_variant_preco_promo' then
            raise exception 'O preço promocional deve ser menor que o preço normal.';
          when 'chk_variant_preco' then
            raise exception 'O preço não pode ser negativo.';
          when 'chk_variant_estoque' then
            raise exception 'O estoque não pode ser negativo.';
          when 'chk_variant_qtd_min' then
            raise exception 'A quantidade mínima deve ser pelo menos 1.';
          else
            raise exception 'Confira os valores das variações e tente novamente.';
        end case;
      end;
  end;

  return v_produto;
end;
$$;

-- ---------- 6. products_com_status ganha nome da categoria ----------
-- Evita N+1 na listagem do painel (join direto na view). p.* ja traz
-- codigo/codigo_visivel automaticamente, sem precisar tocar nisso aqui.
create or replace view public.products_com_status as
select
  p.*,
  c.nome as categoria_nome,
  coalesce(sum(v.saldo_estoque) filter (where v.ativo), 0) as estoque_total,
  coalesce(sum(v.saldo_estoque) filter (where v.ativo), 0) = 0 as esgotado,
  bool_or(v.ativo and v.preco_promocional is not null and v.preco_promocional < v.preco) as em_promocao,
  min(v.preco) filter (where v.ativo) as preco_a_partir_de,
  p.created_at > now() - interval '30 days' as novidade
from public.products p
join public.categories c on c.id = p.category_id
left join public.product_variants v on v.product_id = p.id
group by p.id, c.nome;
