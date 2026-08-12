-- ============================================================
-- TESTE DE ISOLAMENTO DA VITRINE (Fase 0) — tenant_domains + RPCs
-- publicas (get_public_store_settings/categories/products/
-- product_detail), migration 028.
--
-- Separado de proposito do canario de RLS
-- (supabase/tests/isolamento_test.sql, tenant '_teste_isolamento'):
-- aquele precisa continuar SEMPRE ativo=false pra seguir servindo o
-- teste de isolamento de RLS entre staff/authenticated (foi ele que
-- pegou os 3 vazamentos ja documentados em ESCOPO_PROJETO.md) -
-- ligar/desligar repetidamente arriscava deixa-lo no estado errado e
-- quebrar essa ferramenta. Este tenant ('_teste_vitrine') e' dedicado
-- a testar a leitura PUBLICA (anon, via RPC), nasce ja ativo=true, e
-- nunca precisa de toggle.
--
-- Identificacao inequivoca (mesmo padrao do canario): slug comeca com
-- "_teste_", nome contem "TESTE" explicito.
--
-- Roda em duas partes, cada uma com begin/commit proprios (mesma
-- licao registrada no cabecalho de isolamento_test.sql: sem commit
-- explicito fechando a Parte 1, um rollback no fim da Parte 2
-- desfaria tudo, inclusive a criacao do tenant).
--
-- Pre-requisitos antes de rodar:
--   1. Migration 028 ja aplicada (tenant_domains, RPCs, policies
--      *_select_anon dropadas).
--   2. testeecommerce.vluma.com.br confirmado apontando pro mesmo
--      projeto Vercel (fora do escopo deste script - infra de
--      dominio, nao banco).
-- ============================================================

-- ---------- PARTE 1: cria o tenant de teste + dado minimo ----------

begin;

do $$
declare
  v_tenant_vitrine  uuid;
  v_tenant_capua    uuid;
  v_unidade         uuid;
  v_categoria       uuid;
  v_produto         uuid;
begin
  -- ---------- tenant dedicado da vitrine ----------
  insert into public.tenants (slug, nome, ativo)
  values ('_teste_vitrine', 'TESTE — Vitrine (isolamento público via RPC, não é loja real)', true)
  on conflict (slug) do nothing;

  select id into v_tenant_vitrine from public.tenants where slug = '_teste_vitrine';
  select id into v_tenant_capua from public.tenants where slug = 'capua';

  if v_tenant_capua is null then
    raise exception 'Tenant capua não encontrado — aborte e investigue antes de continuar.';
  end if;

  -- ---------- dominios: host de teste -> tenant de teste, host do Cauã -> capua ----------
  insert into public.tenant_domains (tenant_id, dominio)
  values (v_tenant_vitrine, 'testeecommerce.vluma.com.br')
  on conflict (dominio) do nothing;

  insert into public.tenant_domains (tenant_id, dominio)
  values (v_tenant_capua, 'ecommercecauahml.vluma.com.br')
  on conflict (dominio) do nothing;

  -- ---------- store_settings mínimo (get_public_store_settings depende de existir) ----------
  insert into public.store_settings (tenant_id, loja_aberta, pedidos_abertos)
  values (v_tenant_vitrine, true, true)
  on conflict (tenant_id) do nothing;

  -- ---------- unidade de venda mínima ----------
  select id into v_unidade from public.unidades_venda where tenant_id = v_tenant_vitrine and nome = 'Unidade';
  if v_unidade is null then
    insert into public.unidades_venda (tenant_id, nome, ativo)
    values (v_tenant_vitrine, 'Unidade', true)
    returning id into v_unidade;
  end if;

  -- ---------- categoria de teste (ativa) ----------
  select id into v_categoria from public.categories where tenant_id = v_tenant_vitrine and slug = 'teste-categoria-vitrine';
  if v_categoria is null then
    insert into public.categories (tenant_id, nome, slug, ativo)
    values (v_tenant_vitrine, 'TESTE Categoria Vitrine', 'teste-categoria-vitrine', true)
    returning id into v_categoria;
  end if;

  -- ---------- produto de teste (ativo, código visível, com variação em estoque) ----------
  select id into v_produto from public.products where tenant_id = v_tenant_vitrine and slug = 'teste-produto-vitrine';
  if v_produto is null then
    insert into public.products (tenant_id, category_id, nome, slug, unidade_venda_id, ativo, codigo, codigo_visivel)
    values (v_tenant_vitrine, v_categoria, 'TESTE Produto Vitrine', 'teste-produto-vitrine', v_unidade, true, 'TESTEVITRINE-0001', true)
    returning id into v_produto;

    insert into public.product_variants (tenant_id, product_id, nome, preco, ativo, saldo_estoque, sku)
    values (v_tenant_vitrine, v_produto, 'Padrão', 19.90, true, 5, 'TESTEVITRINE-0001-PADR');
  end if;

  raise notice 'Tenant de teste da vitrine pronto — tenant_id=%, categoria_id=%, produto_id=%', v_tenant_vitrine, v_categoria, v_produto;
end $$;

commit;

-- ---------- PARTE 2: chama as RPCs públicas e confere isolamento ----------
-- SECURITY DEFINER não depende de role específico pra funcionar -
-- roda igual seja chamada pelo role do SQL Editor, authenticated ou
-- anon (a diferença de role só importaria se a função dependesse de
-- RLS, e ela deliberadamente não depende).

do $$
declare
  v_produtos_vitrine     int;
  v_categorias_vitrine   int;
  v_settings_vitrine     record;
  v_detalhe_vitrine      jsonb;
  v_produto_vazando      int;
  v_categoria_vazando    int;
  v_host_forjado         record;
begin
  -- ---------- positivo: host de teste enxerga o próprio dado ----------
  select count(*) into v_produtos_vitrine from public.get_public_products('_teste_vitrine');
  select count(*) into v_categorias_vitrine from public.get_public_categories('_teste_vitrine');
  select * into v_settings_vitrine from public.get_public_store_settings('_teste_vitrine');
  select public.get_public_product_detail('_teste_vitrine', 'teste-produto-vitrine') into v_detalhe_vitrine;

  raise notice '--- POSITIVO (host de teste, deve ver o próprio dado) ---';
  raise notice 'produtos via get_public_products(_teste_vitrine) = % (esperado 1)', v_produtos_vitrine;
  raise notice 'categorias via get_public_categories(_teste_vitrine) = % (esperado 1)', v_categorias_vitrine;
  raise notice 'store_settings.loja_aberta = % (esperado true)', v_settings_vitrine.loja_aberta;
  raise notice 'product_detail.nome = %, disponivel[0] = %, estoque numérico presente na resposta? %',
    v_detalhe_vitrine->>'nome',
    v_detalhe_vitrine->'variacoes'->0->>'disponivel',
    (v_detalhe_vitrine->'variacoes'->0 ? 'saldo_estoque');

  -- ---------- negativo: host do Cauã NUNCA vê o dado do tenant de teste ----------
  select count(*) into v_produto_vazando
  from public.get_public_products('capua') gp
  where gp.nome ilike '%TESTE%Vitrine%' or gp.codigo = 'TESTEVITRINE-0001';

  select count(*) into v_categoria_vazando
  from public.get_public_categories('capua') gc
  where gc.nome ilike '%TESTE%Vitrine%';

  raise notice '--- NEGATIVO (host do Cauã, nunca deve ver o dado de teste) ---';
  raise notice 'produto de teste vazando em get_public_products(capua) = % (esperado 0)', v_produto_vazando;
  raise notice 'categoria de teste vazando em get_public_categories(capua) = % (esperado 0)', v_categoria_vazando;

  -- ---------- host forjado/inexistente: nunca resolve, nunca cai num tenant default ----------
  select * into v_host_forjado from public.resolve_tenant_by_host('dominio-que-nao-existe.example.com');
  raise notice '--- HOST FORJADO ---';
  raise notice 'resolve_tenant_by_host(dominio inexistente) = % (esperado NULL/nenhuma linha)', v_host_forjado.slug;

  -- ---------- veredito ----------
  if v_produtos_vitrine = 0 then
    raise warning 'FALHA: get_public_products não trouxe nem o próprio produto do tenant de teste.';
  end if;
  if v_produto_vazando > 0 or v_categoria_vazando > 0 then
    raise warning 'FALHA DE ISOLAMENTO: dado do tenant de teste vazou pro host do Cauã!';
  end if;
  if v_host_forjado.slug is not null then
    raise warning 'FALHA: host forjado resolveu pra um tenant — não deveria resolver pra nenhum.';
  end if;
end $$;

-- Nada de rollback aqui: ao contrário do canário de RLS (que some no
-- fim de cada teste), este tenant fica de pé como fixture reutilizável
-- pra qualquer teste futuro de leitura pública — reaproveitar em vez
-- de recriar. Idempotente (todo insert acima é "só se não existir"),
-- rodar este script de novo não duplica nada.

-- ============================================================
-- LIMPEZA (rodar manualmente só se decidirem remover o tenant de
-- teste por completo — não é o padrão esperado, ele fica como
-- fixture permanente igual ao canário):
--
--   delete from public.product_variants where tenant_id = (select id from public.tenants where slug = '_teste_vitrine');
--   delete from public.products where tenant_id = (select id from public.tenants where slug = '_teste_vitrine');
--   delete from public.categories where tenant_id = (select id from public.tenants where slug = '_teste_vitrine');
--   delete from public.unidades_venda where tenant_id = (select id from public.tenants where slug = '_teste_vitrine');
--   delete from public.store_settings where tenant_id = (select id from public.tenants where slug = '_teste_vitrine');
--   delete from public.tenant_domains where tenant_id = (select id from public.tenants where slug = '_teste_vitrine');
--   delete from public.tenants where slug = '_teste_vitrine';
-- ============================================================
