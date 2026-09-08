-- =====================================================
-- Corrige a causa raiz do DELETE de imagem sendo negado
-- silenciosamente pela RLS do Storage (achado em 04/09/2026, Frente A
-- Inc 3 - ver ESCOPO_PROJETO.md §4).
--
-- Diagnóstico confirmado: a migration 023 criou policies de INSERT/
-- UPDATE/DELETE em storage.objects pro bucket `product-images`, todas
-- com o MESMO predicado (bucket_id + is_staff() + tenant do path) -
-- mas DE PROPÓSITO sem nenhuma policy de SELECT (decisão de revisão
-- de 02/08/2026, pra não descasar a visibilidade de leitura entre
-- anon e authenticated, já que o bucket é público e a leitura de
-- bytes nunca passou por RLS mesmo).
--
-- O que não foi previsto: operações do Storage API que "acham" o(s)
-- objeto(s) antes de agir sobre ele(s) - list(), e sobretudo remove()
-- - fazem uma leitura de storage.objects que TAMBÉM passa pela RLS,
-- independente do bucket ser público (o bypass de RLS do bucket
-- público vale só pro download direto via URL/CDN, não pra consultas
-- feitas pela sessão autenticada via API). Sem NENHUMA policy de
-- SELECT aplicável a `authenticated`, o remove() não enxerga o objeto
-- pra deletar - a API responde sucesso (nenhum erro), mas com a lista
-- de removidos vazia, e nada é apagado de verdade. Confirmado
-- empiricamente: INSERT (não precisa achar o objeto antes, só grava)
-- funciona normalmente; DELETE (precisa achar antes) falha sempre,
-- mesmo pra staff válido do próprio tenant.
--
-- Correção: adiciona a policy de SELECT que faltava, com o MESMO
-- escopo das outras três (staff do próprio tenant, nunca mais que
-- isso) - não amplia a superfície de acesso além do que INSERT/
-- UPDATE/DELETE já permitem, só habilita a leitura interna que essas
-- operações precisam pra funcionar. Não reabre o problema que a
-- revisão de 02/08/2026 evitou: aquela decisão era sobre NÃO dar a
-- `authenticated` uma visão MAIS RESTRITA que `anon` (que já vê tudo
-- via URL pública, sem tenant nenhum) - uma policy de SELECT
-- tenant-scoped pra staff não cria esse descasamento, porque não é
-- usada pra decidir o que aparece na vitrine (isso continua 100% via
-- URL pública, sem RLS) - só destrava as operações de gestão
-- (list/delete) que a própria sessão de staff já tem permissão de
-- fazer (insert/update/delete) mas que precisam desse SELECT interno
-- pra funcionar de verdade.
--
-- Puramente aditiva - não altera nenhuma policy existente, não mexe
-- em tabela nenhuma, não precisa de backfill.
-- =====================================================

drop policy if exists "product_images_storage_staff_select" on storage.objects;
create policy "product_images_storage_staff_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
