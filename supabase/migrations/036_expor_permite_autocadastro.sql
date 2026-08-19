-- =====================================================
-- Fase 2, incremento 2 (Contas de cliente) — expõe
-- `permite_autocadastro` na RPC pública, decidido junto do
-- pacote aprovado em 18/08/2026.
--
-- `store_settings.permite_autocadastro` (boolean, not null
-- default true, existe desde a 002_core.sql) sempre foi
-- deliberadamente EXCLUÍDA de `get_public_store_settings`
-- (comentário original da 028: "operacional/interno, sem uso
-- na vitrine") — porque até agora nenhuma tela pública lia
-- essa flag. Isso muda agora: o lojista passa a controlar se
-- aceita autocadastro de cliente, e o `/cadastro` público
-- precisa ler essa flag pra decidir se mostra o formulário ou
-- uma mensagem de "cadastro fechado no momento" — sem essa
-- coluna na RPC pública, o frontend não tem como saber.
--
-- `drop function` antes do `create` — mesmo motivo já registrado
-- nas migrations 029/030/031: mudar o `RETURNS TABLE` de uma
-- função existente com a mesma assinatura de entrada
-- (`p_tenant_slug text`) não é aceito por `create or replace`
-- (Postgres recusa explicitamente, "cannot change return type
-- of existing function"). Reproduz as 18 colunas já existentes
-- (confirmadas lendo o estado atual da função, migration 031 —
-- não presumidas) mais a coluna nova. Isolamento de tenant
-- (join contra `tenants` por slug+ativo, filtro dentro do corpo
-- da função) e `security definer` inalterados — só a coluna
-- nova entra no SELECT/RETURNS, diff contra a 031 confirma que
-- mais nada muda.
--
-- `baixa_estoque_na_reserva`/`minutos_expiracao_reserva`
-- continuam de fora, de propósito — nenhuma tela pública usa,
-- só `permite_autocadastro` tem consumidor real agora.
-- =====================================================

drop function if exists public.get_public_store_settings(text);

create function public.get_public_store_settings(p_tenant_slug text)
returns table (
  nome text,
  loja_aberta boolean,
  pedidos_abertos boolean,
  mensagem_loja_fechada text,
  mensagem_pedidos_fechados text,
  valor_minimo_pedido numeric,
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
  'Config publica da loja. De proposito NAO expoe: baixa_estoque_na_reserva, minutos_expiracao_reserva - operacionais/internos, sem uso na vitrine. permite_autocadastro (migration 036) PASSA a ser exposta - o /cadastro publico le essa flag pra decidir se mostra o formulario. Campos de banner/selos/whatsapp/cor_principal/logo_path (migrations 030/031) sao conteudo de marketing/identidade, seguros pra leitura publica. rascunho NUNCA aparece aqui - so em get_configuracao_vitrine, exclusiva de staff autenticado.';

grant execute on function public.get_public_store_settings(text) to anon, authenticated;
