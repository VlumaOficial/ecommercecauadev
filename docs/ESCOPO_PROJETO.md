# ESCOPO DO PROJETO — E-commerce Criatório Capuã / VLUMA

**Última atualização:** 29/07/2026
**Baseado em:** leitura completa do código-fonte, migrations `001` a `010`, histórico de commits e `docs/VISAO_CAUA.md`.

---

## 0. Regra de processo (definition of done)

> **Este documento e `docs/REGRAS_DE_NEGOCIO.md` DEVEM ser atualizados a cada nova decisão de produto ou feature entregue, ANTES de considerar a tarefa concluída.** Uma feature só está "pronta" quando: (1) o código está commitado, (2) o build passa, e (3) estes dois documentos refletem a mudança. Isso vale tanto para o assistente quanto para qualquer humano trabalhando no projeto depois.

---

## 1. Visão do produto

E-commerce para o **Criatório Capuã** (peixes ornamentais e animais exóticos), substituindo um processo hoje manual (tabela de preços por WhatsApp → cliente monta lista → conferência manual de estoque → pedido em planilha Excel).

O produto é **arquitetado como SaaS multi-tenant desde a primeira tabela**, mas roda hoje em modo **single-tenant** (um único tenant, `capua`, com `tenant_id` fixo). Isso significa: toda tabela de domínio já tem `tenant_id`, toda escrita passa por RLS que valida `is_staff()`/`is_admin()`, e não há atalhos client-side que hardcodem o tenant — colunas `tenant_id` recebem `DEFAULT public.current_tenant_id()` no banco (não o client que descobre/envia o tenant). Quando o segundo cliente chegar, a evolução para multi-tenant não deve exigir reescrever o modelo de dados, só resolver o tenant a partir do subdomínio (`src/lib/tenant.ts` já isola essa lógica, hoje retornando uma constante).

**Cliente piloto:** Criatório Capuã. **Desenvolvimento:** VLUMA Tecnologia.

---

## 2. Stack e arquitetura

### Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.11 (App Router, Turbopack) + TypeScript 5 |
| UI | React 19.2.4, Tailwind CSS v4, shadcn/ui (preset **Base UI**, não Radix) |
| Ícones/fonte | Lucide React; Geist (corpo) + Syne (`font-display`, títulos) |
| Estado de servidor | TanStack Query v5 |
| Formulários | React Hook Form + Zod (`@hookform/resolvers`) — **sem** o componente `Form` do shadcn, que é acoplado a Radix/Slot e incompatível com o preset Base UI deste projeto; forms usam `register`/`Controller` direto sobre `Input`/`Select`/`Switch`/`Combobox` |
| Backend/dados | Supabase (Postgres + Auth + RLS), `@supabase/ssr` 0.12.3 |
| Deploy | Vercel |

### Padrão de autenticação (importante, decisão custosa de descobrir)

A sessão Supabase é gravada em cookie **`httpOnly: true`** (proteção contra roubo de token via XSS). Consequência arquitetural que se propaga por todo o painel:

- **O client Supabase do navegador (`src/lib/supabase/client.ts`) nunca enxerga a sessão** (JS não lê cookie httpOnly). Qualquer chamada feita direto do browser roda como usuário **anônimo**.
- Por isso, **login e logout são Route Handlers** (`/api/auth/login`, `/sair`), não Server Actions nem client calls — só o servidor lê o cookie.
- Login usa o padrão **POST → 303 See Other** com o `Set-Cookie` anexado à **mesma resposta de redirect** (`NextResponse.redirect` construído *antes* do `signInWithPassword`, cookies gravados via `response.cookies.set` dentro do `setAll`). Anexar cookie a um `NextResponse.redirect` criado separadamente do `cookieStore` **não propaga o `Set-Cookie`** — bug real já caçado e corrigido.
- **Logout precisa ser POST, nunca GET.** O Next.js faz *prefetch* automático de `<Link>` visíveis na viewport; um `GET /sair` que efetua `signOut()` é derrubado pelo próprio prefetch do framework, matando a sessão sem o usuário clicar em nada. Bug real, também já caçado.
- **Toda tela do painel que precisa ler dados além do que a RLS libera para `anon`/leitura pública (ex.: categorias inativas, criar/editar registros) passa por Route Handlers em `/api/painel/<entidade>`**, que usam o client server-side (`src/lib/supabase/server.ts`, lê o cookie via `cookies()` do `next/headers`, autenticado de verdade). Os hooks TanStack Query do painel fazem `fetch()` contra essas rotas — **não** chamam `supabase.from(...)` direto do browser. Esse é o padrão fixado para todo CRUD administrativo daqui pra frente.
- `src/proxy.ts` (renomeado de `middleware.ts` na convenção do Next 16) é **somente leitura**: nunca grava cookie, só decide redirect (`/entrar` ↔ `/painel`) a partir da sessão já existente.

### Padrão de multi-tenant nas escritas

Colunas `tenant_id` ganham `DEFAULT public.current_tenant_id()` (função SQL que resolve o tenant do usuário autenticado via `profiles`/`customers`). Assim nenhum Route Handler precisa descobrir/hardcodar o tenant no `insert()` — já feito para `delivery_cities` (migration `008`) e `categories` (migration `010`); qualquer tabela nova gerida pelo painel deve repetir o padrão.

### Padrão de CRUD administrativo (fixado a partir de Cidades, replicado em Categorias)

- Listagem com filtro de **status** (Ativos/Inativos/Todos) e **busca por nome**, ambos sincronizados na **URL** via `useQueryParamState` (sobrevive a reload, compartilhável por link).
- Criação/edição sempre em **modal** (`Dialog`), nunca página separada — `FormDialog` genérico em `components/painel/crud/`.
- **Soft delete universal**: nenhuma entidade do painel sofre `DELETE` real. Existe um campo `ativo`; "excluir" = inativar. Confirmação (`ConfirmDialog`) só é pedida ao **inativar** (ação com efeito colateral); reativar é instantâneo (exceto quando reativar também tem efeito em cascata — ver Categorias).
- Toast (`sonner`) em toda mutation (criado/atualizado/inativado/reativado).
- Validação client-side (Zod) **e** server-side (Zod de novo, no Route Handler) — o client nunca é a única linha de defesa.
- Componentes genéricos reutilizáveis em `components/painel/crud/`: `StatusFilterTabs`, `SearchInput`, `StatusBadge`, `ConfirmDialog`, `FormDialog`. Primitivo `components/ui/combobox.tsx` (Base UI, select com busca) para seletores com listas grandes (ex.: categoria-pai).
- **📐 Planejado, não implementado:** toda ação de escrita (criar/editar/inativar/reativar) deve chamar um helper `registrarAuditoria()` a partir do Route Handler, gravando em `audit_log` — ver "Auditoria" logo abaixo e decisão #15.

### Auditoria (planejada — 📐 decidida, não implementada)

Tabela genérica `audit_log`: `tenant_id`, `usuario_id`, `acao`, `entidade`, `entidade_id`, `dados_antes jsonb`, `dados_depois jsonb`, `timestamp`. **Registro feito na aplicação** (helper `registrarAuditoria()` chamado explicitamente por cada Route Handler de escrita), **não via trigger de banco** — a decisão foi deliberada: um trigger só vê o `UPDATE` cru na tabela, sem o contexto de negócio (ex.: "esta inativação foi uma cascata disparada a partir da categoria X", "por qual usuário/sessão"), que só a camada de aplicação tem no momento da ação. Isso amarra diretamente com a cascata de categorias (decisão #8): quando a inativação em massa acontecer, o audit_log é o que permite ao Super Admin reconstruir *por que* várias categorias mudaram de status de uma vez.

Propósito: rastreabilidade para o **Super Admin VLUMA** (não para o admin comum do tenant, que não tem acesso a isso) — ver §4 "Planejadas (não iniciadas)", item Super Admin VLUMA. Candidata a feature premium monetizável no SaaS.

---

## 3. Modelo de dados atual

> Tabelas conforme aplicadas até a migration `010` (todas confirmadas aplicadas no banco — ver seção 6).

### Núcleo (`002_core.sql`)

| Tabela | Representa |
|---|---|
| `tenants` | Uma loja/cliente do SaaS. Hoje uma linha (`capua`). |
| `profiles` | Equipe interna (`admin` \| `operador`), 1:1 com `auth.users`. `pode_aceitar_pedido` é permissão granular do operador. |
| `customers` | Cliente final da loja, 1:1 com `auth.users`. |
| `store_settings` | Configuração da loja por tenant (1 linha): `loja_aberta`, `mensagem_loja_fechada`, `pedidos_abertos`, `mensagem_pedidos_fechados`, `permite_autocadastro`, `valor_minimo_pedido`, `baixa_estoque_na_reserva`, `minutos_expiracao_reserva`. Os dois níveis de fechamento (`loja_aberta`/`pedidos_abertos`) foram adicionados na migration `007`. |

Funções: `set_updated_at()` (trigger genérico), `current_tenant_id()`, `is_admin()`, `is_staff()` — todas `security definer`, usadas em RLS e em `DEFAULT` de coluna.

### Catálogo v2 — árvore + variações (`003` recriada pela `009_catalog_v2.sql`)

| Tabela | Representa |
|---|---|
| `categories` | Árvore de categorias via `parent_id` (auto-FK, N níveis). `parent_id = null` → raiz. `slug` único por tenant (namespace global, não por parent — decisão de produto). |
| `category_attributes` | Ficha técnica / atributos configuráveis por categoria (substituiu `subcategory_fields`). `tipo`: `texto \| numero \| selecao \| booleano \| data` (enum `field_type`; valor `'lista'` renomeado para `'selecao'` na 009). **Ainda sem UI** (Fase 2 do CRUD de Categorias — botão "Características" já reservado, desabilitado). |
| `products` | Produto de vitrine: `nome`, `slug`, `descricao`, `category_id`, `unidade_venda`, `destaque` (curadoria manual), `ativo`. **Sem preço nem estoque** — isso vive na variação. |
| `product_variants` | SKU do produto (substituiu os campos de preço/estoque que existiam direto em `products`). `nome` (rótulo, ex. "1kg"), `sku`, `preco`, `preco_promocional` (nullable, `check` garante `< preco`), `modo_estoque` (`quantitativo \| disponibilidade`), `saldo_estoque`, `quantidade_minima`, `ativo`. Produto simples = 1 variant "Padrão"; produto com tamanhos = N variants. |
| `product_attribute_values` | Valor de um `category_attributes` para um produto específico (substituiu `product_field_values`). |
| `product_images` | Fotos do produto (ligadas a `product_id`, compartilhadas entre variações — per-variant image é extensão futura). |
| `product_price_history` | Histórico de preço, agora por **variação** (`variant_id`, com `product_id` denormalizado pra listar o histórico do produto inteiro sem join). Trigger `log_variant_price_change()` dispara em `INSERT/UPDATE OF preco ON product_variants`. |

**Status derivado, não armazenado** (view `products_com_status`, criada na `009`): `esgotado` (soma de `saldo_estoque` das variações ativas = 0), `em_promocao` (existe variação ativa com `preco_promocional < preco`), `novidade` (`created_at` recente), `preco_a_partir_de` (menor preço entre variações ativas). Não existe coluna de "cor"/flag manual de status — é sempre calculado em query.

`subcategories` e `subcategory_fields` **foram removidas** (dropadas na `009`, sem necessidade de migrar dados — ambiente de dev sem catálogo real).

### Entrega (`005_delivery_cities.sql`)

| Tabela | Representa |
|---|---|
| `delivery_cities` | Cidade de entrega: `nome`, `uf`, `ponto_entrega`, `horario`, `observacoes`, `ordem`, `ativo`. `customers.delivery_city_id` referencia esta tabela. Primeiro CRUD do painel, define o padrão de gestão administrativa. |

### Infra

| Tabela | Representa |
|---|---|
| `keepalive_ping` | Singleton (padrão VLUMA v2.1) pingado por GitHub Action a cada 8h pra manter o projeto Supabase free tier ativo. |

### Provisionamento de usuário (`006_handle_new_user.sql`)

Trigger `handle_new_user()` em `auth.users`: lê `raw_user_meta_data.role` no signup e cria a linha correspondente em `profiles` (staff) ou `customers` (cliente final) automaticamente.

---

## 4. Fases

### Concluídas

| Fase | Escopo | Observação |
|---|---|---|
| Setup | Next 16, Tailwind v4, shadcn (Base UI), Supabase, keep-alive | — |
| Modelo de dados núcleo + catálogo v1 + RLS | `002`–`004` | Catálogo v1 (categories/subcategories 2 níveis fixos) depois substituído pela v2 |
| Autenticação | Login, cadastro, recuperação de senha, callback, logout, proteção de rotas via `proxy.ts` | Passou por vários ciclos de bug real (cookie httpOnly + redirect atômico + prefetch de logout) — ver seção 2 |
| Painel — acesso e shell | Layout protegido, sidebar, roteamento por papel (staff → `/painel`), logo/identidade da sidebar | — |
| CRUD de Cidades de entrega | `/painel/cidades` | Define o padrão de CRUD administrativo (URL state, modal, soft delete, Route Handlers) |
| Catálogo v2 (modelagem) | Migration `009`: árvore de categorias, `category_attributes`, `product_variants`, status derivado | Só modelagem — telas de Produtos ainda não existem |
| CRUD de Categorias em árvore | `/painel/categorias` | Árvore colapsável, busca com auto-expand preservando caminho até a raiz, combobox de categoria-pai com exclusão anti-ciclo (client **e** servidor), soft delete sem cascata automática (decisão original) |

### Em andamento / decidido mas não implementado

| Item | Status |
|---|---|
| Bug do slug trocado no modal de editar Categoria | **Causa raiz identificada** (corrida entre dois `useEffect` de `react-hook-form`), correção proposta (`key` por registro) — **não implementada ainda** |
| Cascata inteligente de inativação/reativação de Categorias | Regra de negócio **decidida** (ver `REGRAS_DE_NEGOCIO.md`), modelagem proposta (coluna `inativado_em_cascata` + função `set_category_ativo_cascade`) — **não implementada ainda** |
| Dois níveis de fechamento da loja | Migration `007` **aplicada**; nenhuma UI consome `pedidos_abertos`/`mensagem_pedidos_fechados` ainda (tela de Configurações da loja é planejada, não iniciada) |

### Planejadas (não iniciadas)

- **Características de categoria** (Fase 2 do CRUD de Categorias): CRUD de `category_attributes` por categoria, botão já reservado na árvore.
- **Produtos com variações**: CRUD de `products` + `product_variants` + `product_images` + valores de atributos, reaproveitando o padrão de CRUD e o combobox de categoria.
- **Configurações da loja**: tela para `store_settings` (dois níveis de fechamento, valor mínimo de pedido, autocadastro, regra de baixa de estoque).
- **Vitrine** (`(loja)`, hoje vazio): catálogo público, ficha de produto, Open Graph dinâmico por produto.
- **Carrinho e checkout**: valor mínimo, quantidade mínima por variação, reserva/baixa de estoque atômica no Postgres.
- **Pedidos**: fluxo pendente → aceite (staff) → PDF → envio (WhatsApp/Evolution API, mencionado na visão original, não iniciado).
- **Importação em massa via CSV**: o catálogo real do cliente piloto tem **~1.000 itens** — cadastro manual produto a produto é inviável nessa escala. Importação de produtos/variações via CSV é planejada; fase exata a definir (provavelmente logo após o CRUD de Produtos existir).
- **Super Admin VLUMA**: camada pós-MVP, separada do painel do tenant — gestão multi-tenant (criação de novas lojas), métricas entre clientes, e consumidora do `audit_log` (decisão #15). Ainda não desenhada.
- **Manual do usuário/lojista**: entregável planejado para o final do desenvolvimento — gerado a partir de `docs/REGRAS_DE_NEGOCIO.md` (que já é escrito em linguagem clara, pensado pra isso desde a origem).

---

## 5. Decisões de produto já tomadas

| # | Decisão | Status |
|---|---|---|
| 1 | Catálogo em **árvore** de categorias (N níveis via `parent_id`), não dois níveis fixos | ✅ Implementado |
| 2 | Características de produto (ficha técnica/filtro) são **configuráveis pelo lojista por categoria** (`category_attributes`), não fixas no código | Modelado; UI é Fase 2 |
| 3 | Produto tem **variações/SKU** (`product_variants`); preço, promoção e estoque vivem na variação, não no produto | Modelado; UI ainda não existe |
| 4 | Status de produto (esgotado, em promoção, novidade) é **sempre derivado em query**, nunca uma flag manual gravada | Modelado (view `products_com_status`) |
| 5 | Loja tem **dois níveis independentes de fechamento**: `loja_aberta` (Nível 1, loja inteira inacessível) e `pedidos_abertos` (Nível 2, catálogo visível mas checkout bloqueado) | ✅ Aplicado no banco (migration `007`); UI de configuração ainda não existe |
| 6 | **Soft delete universal**: nenhuma entidade do painel tem exclusão real; sempre campo `ativo` + filtro Ativos/Inativos/Todos | ✅ Implementado no padrão de CRUD |
| 7 | **Modal é o padrão** para toda criação/edição no painel; nunca página separada | ✅ Implementado |
| 8 | Inativar categoria com filhas ativas **cascateia** a inativação pela subárvore, marcando quem foi arrastado (`inativado_em_cascata`) pra permitir restaurar só essas na reativação; quem já estava inativo por conta própria não é tocado em nenhum dos dois sentidos. Ligado à decisão #15: é justamente esse tipo de ação (uma escrita que afeta N linhas por consequência de uma decisão sobre 1) que o `audit_log` existe para explicar depois | Decidido; não implementado |
| 9 | Vitrine (quando construída) deve esconder da navegação uma categoria inativa **e toda a sua subárvore** | Registrado como requisito futuro (comentário em `src/lib/category-tree.ts`); nada a implementar ainda (vitrine não existe) |
| 10 | Slug é gerado automaticamente a partir do nome (editável) — na entrega final ao lojista, o campo de slug deve ficar **oculto/secundário** na interface (detalhe técnico de URL não deve poluir o cadastro do dia a dia de quem não é técnico) | Decidido; hoje o campo aparece visível e editável no modal de Categoria (uso interno/DEV) — ocultar é um ajuste de UX pendente antes da entrega ao cliente final |
| 11 | Arquitetura multi-tenant desde a primeira tabela, tenant fixo no MVP | ✅ Implementado (`tenant_id` + `current_tenant_id()` + RLS) |
| 12 | Sessão em cookie `httpOnly`; toda mutation autenticada do painel passa por Route Handler, nunca client Supabase direto do browser | ✅ Implementado, é o padrão fixado |
| 13 | Perfis de acesso: Admin (total) e Operador (cadastros + permissão granular `pode_aceitar_pedido`) | ✅ Modelado (`profiles.role`, `pode_aceitar_pedido`) |
| 14 | Anti-ciclo em árvores (categoria não pode ter como pai um descendente dela mesma) validado **no client** (combobox exclui opções) **e no servidor** (defesa em profundidade) | ✅ Implementado |
| 15 | **Auditoria** (`audit_log`): toda escrita do painel passa a chamar `registrarAuditoria()` na aplicação (não trigger de banco), pra capturar contexto de negócio (ex.: qual usuário, se foi cascata). Uso: rastreabilidade do Super Admin VLUMA, não do admin do tenant. Candidata a feature premium | 📐 Decidido; não implementado — ver §2, "Auditoria" |
| 16 | **Vocabulário de interface**: telas voltadas ao lojista usam "Características" (nunca "atributos") e "Variações" (nunca "SKU"/"variants") — termos técnicos ficam só no código/banco. Decisão de UX baseada em pesquisa de mercado (Nuvemshop/Shopify) | ✅ Já seguido no CRUD de Categorias (rótulo "Características"); aplicar também ao CRUD de Produtos — ver `REGRAS_DE_NEGOCIO.md` §4.1 |

---

## 6. Ambientes e referências

| Item | DEV (atual) | PRD |
|---|---|---|
| Repositório | `VlumaOficial/ecommercecauadev` | `VlumaOficial/ecommercecaua` (ainda não criado) |
| Domínio | `ecommercecauahml.vluma.com.br` | a definir |
| Supabase ref | `embgxkrfwtbqfkwmquvo` | a definir |
| Deploy | Vercel, deploy automático no push pra `main` | a configurar |

**Pasta local:** `/home/sdorea/vluma/caua` (filesystem nativo WSL — instalação em `/mnt/c/...` é ~1500x mais lenta, lição registrada em `VISAO_CAUA.md`).

**Migrations**: versionadas em `supabase/migrations/`, **aplicadas manualmente pelo usuário via SQL Editor do Supabase** (nunca via `supabase db push` nem CLI a partir do assistente — a conta do CLI usada neste ambiente não tem acesso ao projeto). Numeração sequencial `NNN_nome.sql`, idempotentes (`if not exists`/`if exists` sempre que possível).

**Geração de tipos** (`npm run types` → `supabase gen types typescript`): indisponível neste ambiente (mesma limitação de acesso do CLI). `src/types/database.ts` é **editado à mão** após cada migration aplicada — sempre conferir que reflete exatamente o schema real.

### Estado das migrations

| # | Arquivo | Aplicada? |
|---|---|---|
| 001–006 | núcleo, catálogo v1, RLS, cidades, provisionamento de usuário | ✅ |
| 007 | `store_settings_fechamento` (dois níveis de fechamento) | ✅ |
| 008 | `delivery_cities` ganha `DEFAULT current_tenant_id()` | ✅ |
| 009 | `catalog_v2` (árvore + atributos + variações) | ✅ |
| 010 | `categories` ganha `DEFAULT current_tenant_id()` | ✅ |

### Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_TENANT_SLUG
SUPABASE_SERVICE_ROLE_KEY      (servidor apenas — client em src/lib/supabase/admin.ts, ignora RLS, nunca no browser)
```

Configuradas na Vercel e em `.env.local` (fora do Git).

---

## 7. Estrutura do projeto (atual)

```
src/
├── app/
│   ├── (auth)/           entrar, cadastro, recuperar-senha, nova-senha
│   ├── (loja)/           vazio — vitrine ainda nao construida
│   ├── api/
│   │   ├── auth/login/   POST — login (303 + Set-Cookie atomico)
│   │   └── painel/       Route Handlers de CRUD (cidades, categorias — GET/POST/PATCH)
│   ├── auth/callback/    callback de confirmacao de e-mail / magic link
│   ├── painel/           layout protegido (so staff) + cidades/ + categorias/
│   └── sair/             POST — logout
├── components/
│   ├── painel/
│   │   ├── crud/         StatusFilterTabs, SearchInput, StatusBadge, ConfirmDialog, FormDialog
│   │   ├── cidades/
│   │   └── categorias/
│   └── ui/                20 componentes shadcn (preset Base UI) + combobox.tsx (custom)
├── hooks/                 use-cidades, use-categorias, use-delivery-cities, use-query-param-state
├── lib/
│   ├── supabase/          client.ts (browser), server.ts (SSR/Route Handlers), admin.ts (service_role)
│   ├── auth.ts             getStaffProfile()
│   ├── category-tree.ts   buildTree, getDescendantIds (anti-ciclo), computeVisibleIds, getPath, slugify
│   └── tenant.ts           resolucao de tenant (hoje constante)
├── types/database.ts       tipos gerados/ajustados a mao do schema Supabase
└── proxy.ts                somente leitura: redireciona /entrar <-> /painel

supabase/migrations/        001 a 010, ver secao 6
docs/                        VISAO_CAUA.md (visao original) + este documento + REGRAS_DE_NEGOCIO.md
```

### Débito técnico conhecido

- ~~`src/app/(auth)/entrar/entrar-action.ts` — Server Action de login de uma iteração anterior do fluxo de auth, não usada.~~ **Removida em 29/07/2026** (confirmado sem nenhuma referência no código antes de apagar; build seguiu passando).

---

*Este documento substitui o `docs/VISAO_CAUA.md` como referência de estado atual — o `VISAO_CAUA.md` permanece como registro histórico da concepção inicial do projeto (F1), não é mais atualizado.*
