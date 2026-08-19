-- =====================================================
-- Fase 2, incremento 2 (Contas de cliente) — limpeza de
-- schema em `customers`, decidida junto do pacote aprovado
-- em 18/08/2026 (ESCOPO_PROJETO.md §0 item 36/37).
--
-- 1. `email` vira NOT NULL — é o identificador de login
-- (`REGRAS_DE_NEGOCIO.md` §15.2), sempre preenchido de fato
-- (o INSERT em `handle_new_user`, migration 006, sempre grava
-- `new.email`), mas a coluna nunca teve a restrição formal.
-- Diagnóstico prévio (regra de processo, ESCOPO_PROJETO.md §0
-- "diagnosticar antes de tocar em dados existentes"), rodado
-- na hora de escrever esta migration: as 4 linhas reais de
-- `customers` hoje têm `email` preenchido — `0` linhas com
-- `null`. Seguro aplicar sem backfill.
--
-- 2. `cidade_entrega` (text, coluna original da 002_core.sql)
-- é removida — ficou morta desde que `delivery_city_id` (uuid,
-- FK pra `delivery_cities`) foi criado na migration 005 e
-- passou a ser o campo de verdade usado pelo formulário de
-- cadastro (`/cadastro`) e por `handle_new_user`. Confirmado
-- por grep em todo `src/`: nenhum código lê/escreve nela.
-- Mesmo padrão de limpeza já aplicado ao caso `products.
-- unidade_venda` (texto livre → uuid FK, migrations 019/020).
--
-- Nenhuma RPC/função lê essas colunas de um jeito que quebre
-- com a mudança — `criar_produto_com_variacoes`/etc. não
-- tocam em `customers`; nenhuma RPC pública devolve
-- `cidade_entrega`. Puramente aditiva-defensiva (endurece uma
-- constraint + remove coluna morta), sem efeito em nenhuma
-- tela hoje.
-- =====================================================

alter table public.customers
  alter column email set not null;

alter table public.customers
  drop column if exists cidade_entrega;
