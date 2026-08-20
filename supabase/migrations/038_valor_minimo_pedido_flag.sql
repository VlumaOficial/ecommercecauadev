-- =====================================================
-- Fase 2, incremento 4 (Carrinho client-side) — cria a flag de
-- habilitação do valor mínimo de pedido, decidida em
-- `REGRAS_DE_NEGOCIO.md` §11.4: "nunca R$0,00 = sem mínimo como
-- convenção implícita" — precisa de uma flag EXPLÍCITA separada do
-- valor numérico, pra um valor zero configurado por engano (ou de
-- propósito) nunca ser confundido com "a regra está desligada".
--
-- Diagnóstico prévio (regra de processo): confirmado que só
-- `store_settings.valor_minimo_pedido` (numeric, migration 002)
-- existe hoje — nenhuma coluna booleana de habilitação em lugar
-- nenhum da árvore de migrations.
--
-- `valor_minimo_pedido_habilitado boolean not null default false`:
-- default `false` (não `true`) de propósito — aplicar esta migration
-- não pode ligar uma regra nova pro Cauã (ou qualquer tenant futuro)
-- sem decisão explícita do lojista. `valor_minimo_pedido` continua
-- existindo como já estava (não alterado).
--
-- `get_public_store_settings` ganha a coluna nova — `drop`+`create`
-- de novo, mesmo motivo de sempre (`RETURNS TABLE` não aceita
-- `create or replace` com a mesma assinatura de entrada). Reproduz
-- as 19 colunas já existentes (lidas do estado atual da função na
-- migration 036, não presumidas) mais a nova. Isolamento de tenant
-- e `security definer` inalterados. O carrinho (Fase 2, incremento
-- 4) precisa ler essa flag pra decidir se mostra o aviso de valor
-- mínimo — só informativo neste incremento, o bloqueio de verdade
-- (finalizar pedido) é o incremento 5.
--
-- Puramente aditiva — nenhuma tabela/policy/função existente é
-- tocada além da extensão da própria `get_public_store_settings`.
-- =====================================================

alter table public.store_settings
  add column if not exists valor_minimo_pedido_habilitado boolean not null default false;

drop function if exists public.get_public_store_settings(text);

create function public.get_public_store_settings(p_tenant_slug text)
returns table (
  nome text,
  loja_aberta boolean,
  pedidos_abertos boolean,
  mensagem_loja_fechada text,
  mensagem_pedidos_fechados text,
  valor_minimo_pedido numeric,
  valor_minimo_pedido_habilitado boolean,
  banner_titulo text,
  banner_subtitulo text,
  banner_botao_texto text,
  banner_botao_href text,
  banner_tipo_fundo text,
  banner_cor_fundo text,
  banner_imagem_path text,
  selos jsonb,
  whatsapp_numero text,
  whatsapp_mensagem text,
  cor_principal text,
  logo_path text,
  permite_autocadastro boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.nome,
    s.loja_aberta,
    s.pedidos_abertos,
    s.mensagem_loja_fechada,
    s.mensagem_pedidos_fechados,
    s.valor_minimo_pedido,
    s.valor_minimo_pedido_habilitado,
    s.banner_titulo,
    s.banner_subtitulo,
    s.banner_botao_texto,
    s.banner_botao_href,
    s.banner_tipo_fundo,
    s.banner_cor_fundo,
    s.banner_imagem_path,
    s.selos,
    s.whatsapp_numero,
    s.whatsapp_mensagem,
    s.cor_principal,
    s.logo_path,
    s.permite_autocadastro
  from public.tenants t
  join public.store_settings s on s.tenant_id = t.id
  where t.slug = p_tenant_slug
    and t.ativo = true;
$$;

comment on function public.get_public_store_settings(text) is
  'Config publica da loja. De proposito NAO expoe: baixa_estoque_na_reserva, minutos_expiracao_reserva - operacionais/internos, sem uso na vitrine. permite_autocadastro (036) e valor_minimo_pedido_habilitado (038) sao expostas - o /cadastro e o carrinho publico leem essas flags. Campos de banner/selos/whatsapp/cor_principal/logo_path (030/031) sao conteudo de marketing/identidade, seguros pra leitura publica. rascunho NUNCA aparece aqui - so em get_configuracao_vitrine, exclusiva de staff autenticado.';

grant execute on function public.get_public_store_settings(text) to anon, authenticated;
