-- Vitrine Fase 1, Etapa 4: tela de Configuracoes da Vitrine no painel
-- + fluxo rascunho -> publicar + logo editavel. Preview do rascunho
-- e' protegido por SESSAO de staff (rota /vitrine-preview, fora desta
-- migration - nao precisa de tabela/token nenhum: a RPC de staff
-- get_configuracao_vitrine abaixo, chamada com o client autenticado
-- do proprio painel, ja resolve isso). Revisao de 14/08/2026: a
-- primeira versao desta migration usava um token de posse
-- (vitrine_preview_tokens + get_preview_vitrine anon-callable) pra
-- contornar o cookie de sessao nao atravessar do host do painel pro
-- host da loja - descartada a pedido do usuario antes de aplicar
-- (projeto vai a producao comercial, link de preview vazavel/
-- utilizavel deslogado nao e' adequado). Ver ESCOPO_PROJETO.md §0
-- item 28 (proposta original) e item 29 (revisao aplicada) pro
-- historico completo.
--
-- Os campos PUBLICADOS (banner_*, selos, whatsapp_*, cor_principal -
-- migration 030 - mais logo_path, novo) continuam sendo o que
-- get_public_store_settings devolve pra vitrine publica - o CONTRATO
-- dela pros campos ja existentes nao muda (mesmo nome, mesmo
-- significado, mesma fonte). Ela so ganha a coluna logo_path a mais
-- (extensao, no mesmo espirito das migrations 029/030), porque sem
-- isso o upload de logo desta etapa nao teria efeito nenhum na
-- vitrine publica. rascunho e' um snapshot completo (mesmas chaves)
-- da versao em edicao, nunca lido por ela.

-- ---------- logo editavel (campo publicado novo) ----------

-- null = usa o arquivo estatico atual (public/brand/logocp-icone.png)
-- como fallback no frontend - aplicar esta migration nao muda a logo
-- de nenhum tenant existente.
alter table public.store_settings
  add column if not exists logo_path text;

-- get_public_store_settings ganha a coluna logo_path - drop antes do
-- create pelo mesmo motivo das migrations 029/030 (RETURNS TABLE muda
-- com a mesma assinatura de entrada, Postgres recusa create or
-- replace nesse caso). Isolamento de tenant e security definer
-- inalterados - so a coluna nova entra no SELECT/RETURNS.

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
  logo_path text
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
    s.logo_path
  from public.tenants t
  join public.store_settings s on s.tenant_id = t.id
  where t.slug = p_tenant_slug
    and t.ativo = true;
$$;

comment on function public.get_public_store_settings(text) is
  'Config publica da loja. De proposito NAO expoe: baixa_estoque_na_reserva, minutos_expiracao_reserva, permite_autocadastro - sao operacionais/internos, sem uso na vitrine. Campos de banner/selos/whatsapp/cor_principal/logo_path (migrations 030/031) sao conteudo de marketing/identidade, seguros pra leitura publica. rascunho NUNCA aparece aqui - so em get_configuracao_vitrine, exclusiva de staff autenticado (ver rota /vitrine-preview no frontend).';

grant execute on function public.get_public_store_settings(text) to anon, authenticated;

-- ---------- rascunho ----------

alter table public.store_settings
  add column if not exists rascunho jsonb;

comment on column public.store_settings.rascunho is
  'Snapshot completo dos campos editaveis da identidade da vitrine (banner_titulo/banner_subtitulo/banner_botao_texto/banner_botao_href/banner_tipo_fundo/banner_cor_fundo/banner_imagem_path/selos/whatsapp_numero/whatsapp_mensagem/cor_principal/logo_path) em edicao, ainda nao publicado. NULL = sem rascunho pendente. So lido por get_configuracao_vitrine (staff, abaixo) - nunca por get_public_store_settings. Publicar copia estes valores pros campos publicados e limpa este campo.';

-- ---------- RPCs de staff (autenticado, isolado por tenant) ----------
--
-- Todas seguem o padrao ja usado em criar_produto_com_variacoes etc.:
-- is_staff() checado explicitamente no corpo (raise exception, nao
-- filtro silencioso), tenant sempre resolvido via current_tenant_id()
-- (nunca aceita tenant_id vindo do client). Nenhuma dessas e' grantada
-- pra anon.

create or replace function public.get_configuracao_vitrine()
returns table (
  nome text,
  logo_path text,
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
  rascunho jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  return query
    select
      t.nome,
      s.logo_path,
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
      s.rascunho
    from public.store_settings s
    join public.tenants t on t.id = s.tenant_id
    where s.tenant_id = public.current_tenant_id();
end;
$$;

comment on function public.get_configuracao_vitrine() is
  'Le a configuracao da Vitrine (publicado + rascunho) do tenant do staff logado. Uso exclusivo da tela /painel/vitrine.';

grant execute on function public.get_configuracao_vitrine() to authenticated;

create or replace function public.salvar_rascunho_vitrine(p_rascunho jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  if p_rascunho is null then
    raise exception 'Rascunho vazio.';
  end if;

  update public.store_settings
  set rascunho = p_rascunho
  where tenant_id = public.current_tenant_id();
end;
$$;

comment on function public.salvar_rascunho_vitrine(jsonb) is
  'Grava o snapshot em edicao em store_settings.rascunho - nao afeta a vitrine publica. Sem validacao de forma aqui de proposito (rascunho pode estar incompleto/invalido enquanto o lojista edita) - a validacao de verdade (hex de cor, whatsapp, 4 selos) acontece nas CHECK constraints dos campos publicados, no momento de publicar.';

grant execute on function public.salvar_rascunho_vitrine(jsonb) to authenticated;

create or replace function public.publicar_vitrine()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rascunho jsonb;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  select rascunho into v_rascunho
  from public.store_settings
  where tenant_id = public.current_tenant_id();

  if v_rascunho is null then
    raise exception 'Não há rascunho pendente para publicar.';
  end if;

  -- Campos nullable (imagem/whatsapp/logo) atribuidos direto: um
  -- rascunho que "limpou" o campo (chave presente com valor null) tem
  -- que conseguir remover a imagem/numero publicado, nao so trocar.
  -- Campos NOT NULL usam coalesce como rede de seguranca contra uma
  -- chave ausente no jsonb (o form sempre manda o objeto completo, mas
  -- nao custa nao deixar a publicacao quebrar por um campo faltando).
  update public.store_settings
  set
    logo_path = v_rascunho->>'logo_path',
    banner_titulo = coalesce(v_rascunho->>'banner_titulo', banner_titulo),
    banner_subtitulo = coalesce(v_rascunho->>'banner_subtitulo', banner_subtitulo),
    banner_botao_texto = coalesce(v_rascunho->>'banner_botao_texto', banner_botao_texto),
    banner_botao_href = coalesce(v_rascunho->>'banner_botao_href', banner_botao_href),
    banner_tipo_fundo = coalesce(v_rascunho->>'banner_tipo_fundo', banner_tipo_fundo),
    banner_cor_fundo = coalesce(v_rascunho->>'banner_cor_fundo', banner_cor_fundo),
    banner_imagem_path = v_rascunho->>'banner_imagem_path',
    selos = coalesce(v_rascunho->'selos', selos),
    whatsapp_numero = v_rascunho->>'whatsapp_numero',
    whatsapp_mensagem = coalesce(v_rascunho->>'whatsapp_mensagem', whatsapp_mensagem),
    cor_principal = coalesce(v_rascunho->>'cor_principal', cor_principal),
    rascunho = null
  where tenant_id = public.current_tenant_id();
end;
$$;

comment on function public.publicar_vitrine() is
  'Copia store_settings.rascunho pros campos publicados (lidos por get_public_store_settings) e limpa o rascunho. Atomico - se alguma CHECK constraint dos campos publicados falhar (hex invalido, whatsapp fora do formato, selos != 4), a transacao inteira desfaz, rascunho continua intacto. Falha se nao houver rascunho pendente.';

grant execute on function public.publicar_vitrine() to authenticated;
