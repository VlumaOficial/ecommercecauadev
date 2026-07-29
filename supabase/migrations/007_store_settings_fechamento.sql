-- =====================================================
-- Dois niveis independentes de fechamento da loja
-- Nivel 1 (loja_aberta): loja inteira acessivel ou nao.
-- Nivel 2 (pedidos_abertos): catalogo visivel, mas checkout
--   bloqueado, independente de loja_aberta.
-- Projeto: Criatorio Capua
-- =====================================================

-- loja_aberta ja existe desde 002_core.sql; mantido aqui de forma
-- idempotente para o caso de ambientes que ainda nao tenham a coluna.
alter table public.store_settings
  add column if not exists loja_aberta boolean not null default false;

alter table public.store_settings
  add column if not exists pedidos_abertos boolean not null default false;

-- mensagem_loja_fechada ja existe desde 002_core.sql (com default
-- proprio); ADD COLUMN IF NOT EXISTS aqui e um no-op nesse caso.
alter table public.store_settings
  add column if not exists mensagem_loja_fechada text
    default 'Estamos fora do período de vendas. Volte em breve para o próximo ciclo.';

alter table public.store_settings
  add column if not exists mensagem_pedidos_fechados text
    default 'A vitrine está aberta, mas os pedidos deste ciclo ainda não começaram. Fique de olho!';

-- Corrige o default antigo de mensagem_loja_fechada (definido em
-- 002_core.sql) para o texto amigavel usado a partir de agora.
alter table public.store_settings
  alter column mensagem_loja_fechada
  set default 'Estamos fora do período de vendas. Volte em breve para o próximo ciclo.';

-- Preenche as mensagens amigaveis nas linhas ja existentes: so onde
-- estiver nula ou ainda com o texto antigo (nao sobrescreve mensagens
-- customizadas que um admin ja possa ter definido).
update public.store_settings
set mensagem_loja_fechada = 'Estamos fora do período de vendas. Volte em breve para o próximo ciclo.'
where mensagem_loja_fechada is null
   or mensagem_loja_fechada = 'A loja esta fechada no momento. Aguarde a abertura do proximo ciclo.';

update public.store_settings
set mensagem_pedidos_fechados = 'A vitrine está aberta, mas os pedidos deste ciclo ainda não começaram. Fique de olho!'
where mensagem_pedidos_fechados is null;
