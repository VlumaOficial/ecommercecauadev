-- Vitrine Fase 1, Etapa 3: banner, selos de confianca, WhatsApp e
-- identidade (cor principal) deixam de ser fixos no codigo e viram
-- dado em store_settings. Etapa 4 (tela de edicao no painel) ainda
-- nao existe - esta migration so cria os campos, com DEFAULT igual
-- ao valor hoje hardcoded em cada componente, pra a vitrine nao mudar
-- de aparencia so por essa migration rodar. A vitrine passa a LER
-- desses campos (frontend ja deployado, tolerando a ausencia deles
-- ate esta migration ser aplicada - mesmo padrao da migration 029).
--
-- store_settings e' por tenant (chave primaria tenant_id) - nenhum
-- campo novo aqui muda isso, e get_public_store_settings continua
-- filtrando tenant no corpo (join contra tenants por slug+ativo,
-- igual antes). Nenhum campo novo e' sensivel (banner/selos/whatsapp/
-- cor sao conteudo de marketing, ja pensados pra aparecer na vitrine
-- publica).

-- ---------- Banner ----------

alter table public.store_settings
  add column if not exists banner_titulo text not null
    default 'Peixes ornamentais direto do criatório';

alter table public.store_settings
  add column if not exists banner_subtitulo text not null
    default 'Qualidade, saúde e variedade. Monte seu pedido e retire no ponto de encontro da sua cidade.';

alter table public.store_settings
  add column if not exists banner_botao_texto text not null
    default 'Ver catálogo →';

alter table public.store_settings
  add column if not exists banner_botao_href text not null
    default '/produtos';

-- 'cor' (usa banner_cor_fundo) ou 'imagem' (usa banner_imagem_path,
-- com overlay escuro automatico aplicado pela vitrine pra legibilidade
-- do texto - decisao de UI, nao fica gravado no banco).
alter table public.store_settings
  add column if not exists banner_tipo_fundo text not null default 'cor';

alter table public.store_settings
  add constraint chk_store_settings_banner_tipo_fundo
    check (banner_tipo_fundo in ('cor', 'imagem'));

-- Default = a mesma cor teal usada hoje no gradiente hardcoded do
-- hero (--primary). A vitrine constroi um gradiente leve A PARTIR
-- desta cor (nao fica achatada/solida) pra manter a aparencia atual
-- por default - ver banner-hero.tsx.
alter table public.store_settings
  add column if not exists banner_cor_fundo text not null default '#0891b2';

alter table public.store_settings
  add constraint chk_store_settings_banner_cor_fundo
    check (banner_cor_fundo ~ '^#[0-9a-fA-F]{6}$');

-- Storage path no bucket publico product-images (mesmo bucket das
-- fotos de produto - nao existe bucket separado pra assets da loja
-- ainda, e nao ha necessidade de criar um so pra isto). Null =
-- nenhuma imagem configurada, banner_tipo_fundo deve ficar 'cor'
-- nesse caso (nao imposto via CHECK pra nao travar o fluxo de edicao
-- futuro da Etapa 4 - ex. lojista troca pra 'imagem' antes de acabar
-- de subir o arquivo -, mas a vitrine trata null como fallback pra
-- cor mesmo que tipo_fundo diga 'imagem').
alter table public.store_settings
  add column if not exists banner_imagem_path text;

-- ---------- Selos de confianca ----------

-- 4 selos fixos (nao e' uma lista de tamanho livre) - JSONB em vez de
-- 16 colunas (4 selos x titulo/subtitulo/icone/ativo) fica mais limpo
-- de ler/escrever como uma unidade so, e a Etapa 4 vai editar os 4 de
-- uma vez na mesma tela mesmo. icone e' uma chave de string (ex.
-- 'truck', 'fish') resolvida pra um componente de icone no frontend -
-- lista de chaves permitidas fica no frontend (Etapa 4 vai expor um
-- seletor com essa lista), nao validada aqui por CHECK pra nao
-- duplicar a fonte da verdade antes de existir a tela de edicao.
alter table public.store_settings
  add column if not exists selos jsonb not null default '[
    {"titulo": "Retirada combinada", "subtitulo": "Ponto de encontro por cidade", "icone": "truck", "ativo": true},
    {"titulo": "Chegada viva", "subtitulo": "Garantia no transporte", "icone": "shield-check", "ativo": true},
    {"titulo": "Atendimento próximo", "subtitulo": "Fale direto pelo WhatsApp", "icone": "headset", "ativo": true},
    {"titulo": "Criação própria", "subtitulo": "Direto do criatório", "icone": "fish", "ativo": true}
  ]'::jsonb;

alter table public.store_settings
  add constraint chk_store_settings_selos_length
    check (jsonb_array_length(selos) = 4);

-- ---------- WhatsApp ----------

-- Formato internacional sem simbolos (so digitos, DDI+DDD+numero -
-- ex. 5511999999999), pronto pra virar wa.me/NUMERO. Null = botao
-- flutuante nao aparece na vitrine (default - nao existe hoje, entao
-- nao mudar a aparencia significa continuar sem o botao ate o
-- lojista configurar).
alter table public.store_settings
  add column if not exists whatsapp_numero text;

alter table public.store_settings
  add constraint chk_store_settings_whatsapp_numero
    check (whatsapp_numero is null or whatsapp_numero ~ '^[0-9]{10,15}$');

alter table public.store_settings
  add column if not exists whatsapp_mensagem text not null
    default 'Olá! Vim da loja e gostaria de saber mais sobre os peixes.';

-- ---------- Identidade ----------

-- Cor principal da marca (hoje o teal fixo em .loja-theme /
-- globals.css). Alimenta --primary (e --ring) do tema da vitrine via
-- style inline no wrapper do layout - nao mexe nos outros tokens
-- (--secondary/--accent/--muted, tons neutros claros) pra nao exigir
-- uma paleta derivada inteira nesta etapa; --primary-foreground e'
-- calculado no frontend por contraste (claro/escuro) a partir desta
-- cor, nao fica gravado.
alter table public.store_settings
  add column if not exists cor_principal text not null default '#0891b2';

alter table public.store_settings
  add constraint chk_store_settings_cor_principal
    check (cor_principal ~ '^#[0-9a-fA-F]{6}$');

-- ---------- RPC publica: get_public_store_settings ----------
--
-- Precisa DROP antes do CREATE porque muda o RETURNS TABLE com a
-- mesma assinatura de entrada (p_tenant_slug text) - Postgres recusa
-- CREATE OR REPLACE nesse caso ("cannot change return type of
-- existing function"), mesma situacao ja tratada na migration 029
-- pra get_public_products. Isolamento de tenant (join contra tenants
-- por slug+ativo, filtro dentro do corpo da funcao) e security
-- definer inalterados - so' colunas novas no SELECT/RETURNS.

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
  cor_principal text
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
    s.cor_principal
  from public.tenants t
  join public.store_settings s on s.tenant_id = t.id
  where t.slug = p_tenant_slug
    and t.ativo = true;
$$;

comment on function public.get_public_store_settings(text) is
  'Config publica da loja. De proposito NAO expoe: baixa_estoque_na_reserva, minutos_expiracao_reserva, permite_autocadastro - sao operacionais/internos, sem uso na vitrine. Campos de banner/selos/whatsapp/cor_principal (migration 030) sao conteudo de marketing/identidade, seguros pra leitura publica.';

grant execute on function public.get_public_store_settings(text) to anon, authenticated;
