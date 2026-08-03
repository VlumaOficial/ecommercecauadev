-- =====================================================
-- Produtos Etapa 3 (Imagens): estende a tabela product_images (ja
-- existente desde a migration 003, isolada por tenant desde 013/014,
-- nunca usada por nenhuma tela ate agora) pra suportar imagem por
-- variacao (opcional), corrige o gap de DEFAULT current_tenant_id()
-- que ela nunca ganhou (diferente de todas as outras tabelas de
-- dominio), adiciona a RPC que troca a capa atomicamente, e configura
-- o bucket do Supabase Storage + suas policies de escrita/exclusao.
-- Decisoes fechadas com o usuario em 02-03/08/2026 (plano aprovado
-- antes desta migration):
--
--   1. Exclusao REAL de imagem (nao soft delete) - excecao explicita
--      ao padrao "soft delete universal" (decisao #6) deste projeto.
--      Justificativa: uma foto removida nao tem fluxo de "reativar"
--      que faca sentido pro lojista, e manter linha+arquivo orfaos
--      pra sempre so acumula custo de Storage sem beneficio nenhum.
--      Aplicado no lado da aplicacao (Route Handler de DELETE), nao
--      requer nada de schema aqui alem do "on delete cascade" ja
--      existente pra quando o PRODUTO/VARIACAO em si for removido
--      (o que na pratica nunca acontece, por serem soft-delete).
--   2. Limite de quantidade (10 imagens/produto, 5/variacao) e
--      validado no client E no Route Handler de upload (proximo
--      passo, fora desta migration) - de proposito NAO e uma
--      constraint de banco nem trigger: e um teto cosmetico/de UX, nao
--      uma invariante de negocio critica (diferente do saldo de
--      estoque) - uma pequena corrida rara deixando 11 em vez de 10
--      imagens tem severidade baixa o suficiente pra nao justificar a
--      complexidade de um lock/RPC dedicado so pra isso.
--   3. Otimizacao client-side (canvas -> WebP, ~1600px, qualidade 0.8)
--      - decisao de frontend, nao muda nada aqui.
--   4. alt_text exposto na tela - coluna ja existe desde a 003, so a
--      UI que vai passar a usa-la.
--   5. Bucket publico pra leitura (sem RLS - Storage bypassa RLS pra
--      buckets marcados publicos), escrita/exclusao isolada por
--      tenant via o path do arquivo. Ver PASSO 5 abaixo, e o
--      destaque de seguranca ali.
-- Projeto: Criatorio Capua
-- =====================================================

-- ---------- 1. product_images ganha variant_id (nullable = imagem de produto) ----------
alter table public.product_images
  add column if not exists variant_id uuid references public.product_variants(id) on delete cascade;

create index if not exists idx_product_images_variant on public.product_images(variant_id, ordem);

-- ---------- 2. Capa (principal) so pode ser imagem de PRODUTO, nunca de variacao ----------
-- "Imagem principal (capa) por produto" no escopo aprovado - nao
-- existe capa por variacao. Sem isso, nada impediria marcar uma foto
-- especifica de uma variacao como a capa do produto inteiro.
do $$ begin
  alter table public.product_images
    add constraint chk_product_images_capa_so_produto
    check (variant_id is null or principal = false);
exception when duplicate_object then null; end $$;

-- ---------- 3. Corrige o gap: tenant_id nunca teve DEFAULT (diferente de toda outra tabela de dominio) ----------
-- product_images foi criada na 003, antes do padrao "DEFAULT
-- current_tenant_id()" existir, e nunca recebeu a mesma correcao que
-- delivery_cities (008), categories (010), category_attributes (012)
-- e products/product_variants (015) ja receberam - passou despercebido
-- por nunca ter sido usada ate agora.
alter table public.product_images
  alter column tenant_id set default public.current_tenant_id();

-- ---------- 4. RPC: trocar a imagem principal atomicamente ----------
-- Duas linhas mudando "principal" em statements separados (desmarcar
-- a antiga, marcar a nova) correm risco de violar o indice unico
-- parcial idx_product_images_principal no meio do caminho se feito
-- como dois .update() independentes do client. A RPC garante as duas
-- mudancas na mesma transacao.
create or replace function public.definir_imagem_principal(p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_imagem record;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  select product_id, variant_id into v_imagem
  from public.product_images
  where id = p_image_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'Imagem não encontrada.';
  end if;

  if v_imagem.variant_id is not null then
    raise exception 'Apenas imagens do produto podem virar capa (imagens de variação, não).';
  end if;

  update public.product_images
  set principal = false
  where product_id = v_imagem.product_id
    and principal = true
    and id <> p_image_id;

  update public.product_images
  set principal = true
  where id = p_image_id;
end;
$$;

-- ---------- 5. Bucket do Supabase Storage ----------
-- Publico pra LEITURA: URLs publicas de imagem de produto nao passam
-- por RLS nenhuma quando o bucket e marcado publico (e assim que o
-- Storage do Supabase funciona) - mesma filosofia ja usada em
-- "images_select_anon using(true)" na tabela product_images. Sem foto
-- sensivel aqui, e a vitrine (ainda nao construida) vai precisar ler
-- sem sessao nenhuma.
--
-- file_size_limit em bytes (5MB) e allowed_mime_types sao uma trava
-- dura no proprio Storage - defesa em profundidade alem da validacao
-- no client e no Route Handler de upload (nunca confiar so no client).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- =====================================================
-- ⚠️ DESTAQUE DE SEGURANCA — REVISAR COM ATENCAO ⚠️
--
-- Estas tres policies garantem que staff de um tenant NUNCA consiga
-- subir/alterar/apagar arquivo na pasta de outro tenant no Storage.
-- Path de cada arquivo e sempre "{tenant_id}/{product_id}/{id}.webp"
-- (regra de aplicacao, nao imposta pelo banco) - cada policy le o
-- PRIMEIRO segmento do path (storage.foldername(name))[1] e exige que
-- seja exatamente igual ao tenant_id do usuario autenticado
-- (current_tenant_id()), alem de exigir is_staff(). Sem essa condicao
-- de path, qualquer staff autenticado poderia escrever em qualquer
-- pasta de qualquer tenant - seria o MESMO tipo de vazamento cross-
-- tenant ja corrigido nas migrations 013/014/018, so que no Storage
-- em vez do Postgres.
--
-- DE PROPOSITO so insert/update/delete - SEM policy de select.
-- Correcao de revisao (02/08/2026): a versao anterior usava "for all"
-- (cobria select tambem), o que criava um descasamento anon vs.
-- authenticated na LEITURA - exatamente a mesma classe de bug da
-- migration 014, so que ao contrario: leitura anonima bypassa RLS
-- (bucket publico), leitura de uma sessao AUTENTICADA passaria a ser
-- avaliada pela policy e seria barrada pra imagem de outro tenant (ou
-- ate do proprio tenant, por exigir is_staff() - um cliente final
-- logado nunca e staff). Removendo a policy de select por completo,
-- authenticated fica na MESMA situacao que anon pra leitura: nenhum
-- dos dois tem policy de select aplicavel, os dois dependem
-- exclusivamente da URL publica do bucket (que bypassa RLS
-- inteiramente) - sem nenhum descasamento entre os dois.
-- =====================================================
drop policy if exists "product_images_storage_staff_write" on storage.objects;

drop policy if exists "product_images_storage_staff_insert" on storage.objects;
create policy "product_images_storage_staff_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists "product_images_storage_staff_update" on storage.objects;
create policy "product_images_storage_staff_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
  with check (
    bucket_id = 'product-images'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists "product_images_storage_staff_delete" on storage.objects;
create policy "product_images_storage_staff_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
