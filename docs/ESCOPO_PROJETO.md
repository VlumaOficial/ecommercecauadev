# ESCOPO DO PROJETO — E-commerce Criatório Capuã / VLUMA

**Última atualização:** 01/08/2026 (data original de criação do documento: 30/07/2026)
**Baseado em:** leitura completa do código-fonte, migrations `001` a `012`, histórico de commits e `docs/VISAO_CAUA.md`.

> **Princípio norteador:** este é um produto **SaaS** (VLUMA). O Criatório Capuã é o primeiro cliente e validador, mas as decisões são de **produto** — o critério é "isso serve qualquer lojista do segmento?", não "o Cauã precisa disso?". Justificativas de arquitetura baseadas só na realidade de um cliente devem ser evitadas.

### 📌 Pendências abertas agora (checar primeiro, 01/08/2026)

1. ~~Re-teste da Etapa 1 de Produtos contra a URL pública (`ecommercecauahml.vluma.com.br`), não `localhost` — o teste anterior rodou local antes do push.~~ **✅ Resolvido — reconfirmado em 02/08/2026** com um teste dedicado contra a URL pública (além de toda a atividade cumulativa do resto desta sessão — Bug 1/2, Unidades de Venda, Melhoria 4, módulo de Estoque — que já exercitou CRUD de produto repetidamente na URL pública sem problema): confirmados os 3 bugs originalmente encontrados e corrigidos continuam corrigidos (`preco_promocional` vazio vira `null`, não `0`; nenhum warning de acessibilidade de `nativeButton` no console; validação Zod aparece pro preço negativo, sem tooltip nativo do navegador) — mais criar produto, adicionar variação, remover variação (soft delete confirmado via diff-sync), busca na listagem, inativar/reativar. Produto de teste limpo (inativado) ao final. Ver linha "CRUD de Produtos — Etapa 1" na tabela "Concluídas" pra detalhe completo.
2. **Sessão expirando (~1h) sem renovação — suspeita não confirmada, pode impactar o Cauã em produção.** Ver nota detalhada em §2 "Padrão de autenticação" (`proxy.ts` tem `setAll()` vazio de propósito; comentário em `server.ts` contradiz isso). Não reproduzido ao vivo ainda — precisa investigar antes de decidir a correção.
3. Migrations `015`–`017` já aplicadas, tudo commitado e pushado (`git log origin/main` = `git log` local) — sem pendência de banco ou de git no momento em que este documento foi escrito.
4. `product_images` (Etapa 3, fotos de produto) e `product_attribute_values` (Etapa 2, ficha técnica por produto) do CRUD de Produtos — não iniciados, fora do escopo da Etapa 1.
5. Arquivo `supabase/migrations/novo 6.txt` não rastreado pelo git — não foi criado por nenhuma sessão do assistente (verificado: já aparecia como untracked no primeiro `git status` desta sessão). Provavelmente rascunho do usuário; não mexer sem perguntar.
6. ~~TERCEIRO vazamento cross-tenant diagnosticado em 01/08/2026, migration `018_products_com_status_security_invoker.sql` criada — aguardando revisão e aplicação manual.~~ **✅ Resolvido em 01/08/2026** — migration `018` aplicada pelo usuário; `reloptions` da view confirmado `security_invoker=true`; reteste de isolamento com o canário confirmou `de_outro_tenant=0`. Ver §2 e §6 para o detalhe completo.
7. **⚠️→✅ Incidente de produção, 01/08/2026 — cadastro/edição de produto quebrado por alguns minutos.** A migration `019` (Melhoria 3, Unidades de Venda) foi aplicada pelo usuário no banco antes do frontend correspondente existir: as RPCs `criar_produto_com_variacoes`/`atualizar_produto_com_variacoes` passaram a exigir `unidade_venda_id` (uuid), mas o painel ainda enviava o campo de texto livre antigo (`unidade_venda`) — toda tentativa de criar/editar produto em produção falhava com "Unidade de venda não encontrada." Confirmado ao vivo com Chromium (`POST /api/painel/produtos` → 400) antes da correção. **Corrigido no mesmo dia**: frontend atualizado (Route Handlers, tipos, formulário com Combobox de unidade + novo cadastro `/api/painel/unidades-venda`), commitado, pushado, e reconfirmado ao vivo (`POST` → 201, produto de teste criado e depois inativado via soft delete, sem deixar lixo em produção). **Lição de processo**: quando uma migration muda o contrato de uma RPC consumida pelo frontend (não só adiciona/relaxa algo), o frontend correspondente precisa estar pronto e deployado **antes** ou **junto** da aplicação da migration no banco — não depois. Migrations puramente aditivas/RLS (`013`–`018`) não tinham esse risco por não mudarem payload de RPC nenhuma; `019` foi a primeira migration desta série a mudar assinatura de RPC consumida pelo painel.
8. ~~Migration `020` (drop da coluna antiga `products.unidade_venda`) ainda não aplicada~~ **✅ Aplicada com sucesso em 01/08/2026** (2ª tentativa, versão corrigida). Confirmado ao vivo contra a URL pública: `GET /api/painel/produtos` retorna as colunas sem `unidade_venda` (só `unidade_venda_id`), e `POST /api/painel/produtos` (criar produto) continua funcionando normalmente (201) — a view `products_com_status` foi recriada corretamente. `security_invoker = true` foi declarado explicitamente na própria `CREATE VIEW` desta migration (não reverificado via `pg_class` desta vez — a confirmação é por leitura do SQL aplicado, não por reteste de isolamento cross-tenant; se quiser essa confirmação extra, é rodar `select reloptions from pg_class where relname = 'products_com_status'` no SQL Editor). Ver `docs/MIGRATIONS.md` (migration `020`).
9. ~~Tela de gestão `/painel/unidades-venda` ainda não implementada~~ **✅ Resolvido em 01/08/2026** — tela `/painel/unidades-venda` implementada (mesmo padrão de Cidades: nome + ativo, listagem/criar/editar/inativar/reativar), adicionada ao menu lateral, **testada com Chromium real contra a URL pública**: listagem confirmada com as 6 unidades do seed, unidade de teste criada e depois inativada com sucesso (soft delete, sem lixo em produção). **Melhoria 3 (Unidades de Venda) está completa** — falta só o usuário reaplicar a migration `020` corrigida (item 8 acima) para remover a coluna de texto livre antiga, que hoje só fica sem uso no banco.

---

## 0. Regra de processo (definition of done)

> **Este documento e `docs/REGRAS_DE_NEGOCIO.md` DEVEM ser atualizados a cada nova decisão de produto ou feature entregue, ANTES de considerar a tarefa concluída.** Uma feature só está "pronta" quando: (1) o código está commitado, (2) o build passa, e (3) estes dois documentos refletem a mudança. Isso vale tanto para o assistente quanto para qualquer humano trabalhando no projeto depois.

### Rotina de fim de feature

Ao concluir cada feature, **antes de considerá-la pronta**:

1. Código commitado e build passando.
2. `ESCOPO_PROJETO.md` e `REGRAS_DE_NEGOCIO.md` atualizados — **adicionar/complementar, nunca remover histórico**.
3. Commit dos docs (separado ou junto do commit de código).
4. **Toda feature com UI testada com Chromium real (headless) contra o ambiente**, não só `npm run build`/typecheck — ver padrão detalhado abaixo.

Se a sessão estiver longa, encerrar com os docs atualizados e commitados, para que uma sessão nova possa retomar lendo só os documentos.

### Convenção de comunicação com o consultor de PO/UX/Engenharia

**📐 Registrada em 01/08/2026.** Ao final de **toda** resposta do assistente, incluir um bloco delimitado por `=== PARA O PO/UX/ENGENHEIRO ===` e `=== FIM ===`, contendo **apenas** o que precisa de decisão de produto/arquitetura ou revisão de SQL/segurança (perguntas em aberto, SQL a revisar, decisões de design). **Não** incluir explicações longas, logs de build, nem detalhes operacionais nesse bloco. Se a tarefa foi puramente operacional, escrever apenas "Nada para o PO/UX/Engenheiro nesta [resposta/tarefa]". Este bloco é o que Sérgio repassa ao consultor — mantê-lo enxuto reduz o consumo de tokens da revisão.

### Padrão de teste: Chromium real antes de considerar pronto

**✅ Formalizado em 31/07/2026** — já vinha sendo seguido informalmente desde Características de categoria, o fix do bug de slug e a cascata de inativação/reativação (todas pegaram bug real assim, antes da revisão humana). Agora é regra obrigatória, não boa prática opcional.

- Toda feature que envolve UI (tela nova, formulário, listagem, fluxo do painel) é testada com **Chromium real em modo headless** contra o ambiente rodando, antes de ser considerada pronta — `npm run build` (compilação/typecheck) sozinho não é suficiente, ele não pega bug de comportamento em runtime.
- O teste cobre os **fluxos principais** da feature (ex.: criar, editar, listar) e os **casos de borda relevantes** (ex.: validação, mensagem de erro, estado vazio).
- Quando a feature grava no banco, o teste **confirma a persistência real** (reconsultando o dado após a ação, não só confiando no retorno visual da tela).
- O resultado do teste (o que foi testado, o que passou, qualquer ajuste feito por causa dele) é **reportado junto com a entrega da feature** — mesmo padrão de transparência já usado nas entregas anteriores ("Testado com Chromium real: ...").

**⚠️ Correção crítica, 01/08/2026:** "ambiente rodando" acima ficou ambíguo e foi mal interpretado numa sessão — o teste da Etapa 1 de Produtos rodou o Chromium contra `npm run dev` (`localhost:3000`), nunca pushado nem deployado. Resultado: a feature foi reportada como "testada e pronta", mas os commits nunca chegaram no `origin/main` nem na Vercel — usuário real (Sérgio) bateu 404 em produção. **Essa regra já existia antes**, registrada em `VISAO_CAUA.md` ("sem execução de `npm run dev`... homologação na Vercel"), mas não foi carregada pra este documento nem consultada antes de montar o teste. Regra reforçada e explícita a partir de agora: **"ambiente rodando" significa a URL pública após `git push` + deploy da Vercel concluído — nunca só `npm run dev` local.** `npm run dev`/`localhost` só serve para iteração rápida durante o desenvolvimento, nunca como validação final de "pronto". Antes de reportar qualquer feature como testada, confirmar: (1) commit pushado pro `origin/main` (`git log origin/main` bate com o local), (2) deploy da Vercel concluído (não só disparado), (3) só então testar contra a URL pública.

### Rastreabilidade de migrations ajustadas ou descartadas

Migration criada e commitada, mas **ainda não aplicada**, pode precisar mudar antes de ir pro banco (ex.: dependência de uma decisão posterior, como o isolamento por tenant — decisão #21). Quando isso acontecer: **nunca apagar o registro da decisão original em silêncio**. Documentar aqui (tabela de migrations em §6, e no ponto onde a feature é descrita): o que foi descartado/ajustado, por quê, e o que substituiu — mantendo visível o histórico de que a versão original existiu e a razão da mudança. O arquivo `.sql` em si pode ser removido/renomeado do `supabase/migrations/` (não faz sentido manter SQL morto versionado), mas a **decisão e o motivo continuam registrados nos docs**.

**Ao iniciar qualquer sessão nova**, o primeiro passo é ler `docs/ESCOPO_PROJETO.md` e `docs/REGRAS_DE_NEGOCIO.md` para recuperar o contexto.

### Aprendizado de processo: diagnosticar antes de tocar em dados existentes

Registrado em 31/07/2026, a partir da experiência de montar o teste de isolamento (`supabase/tests/isolamento_test.sql`): a primeira tentativa de script assumiu que o usuário de teste já teria um `profile` de staff, sem checar antes — só depois de o teste falhar (e de mais uma rodada de causa raiz sobre transação/commit) é que ficou claro que ele existia apenas como `customer`. **Regra adotada daqui pra frente**: antes de montar qualquer script ou feature que crie, mova ou modifique dados já existentes (usuários, registros de teste, dados de produção), rodar primeiro um diagnóstico somente-leitura (`SELECT` simples confirmando o estado atual) e só então desenhar a lógica de escrita em cima do que foi confirmado — não do que se assume que deveria estar lá. Reduz retrabalho e evita lógica condicional (tipo "se existir, faz X, senão faz Y") escrita às cegas, sem validar qual dos dois casos é o real antes de programar os dois.

### Registro de tempo por feature

| Feature | Início | Conclusão | Nº de sessões |
|---|---|---|---|
| Características de categoria | 30/07/2026 15:31 | 30/07/2026 17:12 | 1 |
| CRUD de Produtos — Etapa 1 (núcleo, incluindo isolamento por tenant como pré-requisito) | 30/07/2026 | 01/08/2026 | 3 |

---

## 1. Visão do produto

E-commerce para o **Criatório Capuã** (peixes ornamentais e animais exóticos), substituindo um processo hoje manual (tabela de preços por WhatsApp → cliente monta lista → conferência manual de estoque → pedido em planilha Excel).

O produto é **arquitetado como SaaS multi-tenant desde a primeira tabela**, mas roda hoje em modo **single-tenant** (um único tenant, `capua`, com `tenant_id` fixo). Isso significa: toda tabela de domínio já tem `tenant_id`, toda escrita passa por RLS que valida `is_staff()`/`is_admin()`, e não há atalhos client-side que hardcodem o tenant — colunas `tenant_id` recebem `DEFAULT public.current_tenant_id()` no banco (não o client que descobre/envia o tenant). Quando o segundo cliente chegar, a evolução para multi-tenant não deve exigir reescrever o modelo de dados, só resolver o tenant a partir do subdomínio (`src/lib/tenant.ts` já isola essa lógica, hoje retornando uma constante).

**Cliente piloto:** Criatório Capuã. **Desenvolvimento:** VLUMA Tecnologia.

### Estratégia de evolução para SaaS (roadmap arquitetural)

**📐 Decidida em 31/07/2026 — ver decisão #22 em §5.** Define a ordem macro do projeto daqui pra frente:

1. **Isolamento total por tenant, agora** — antes de seguir com qualquer feature nova (a começar por Produtos), fechar a base de RLS/RPCs pra garantir que o modelo multi-tenant já declarado (§1) funcione de verdade, não só na estrutura das tabelas. Ver decisão #21.
2. **Desenvolvimento do produto para o Cauã continua sobre essa base isolada** — Produtos, Vitrine, Carrinho/Checkout, Pedidos etc., seguindo o roadmap de §4.
3. **Cauã fechado (produto completo) → vai para produção como tenant único.** Primeiro cliente real, ambiente de produção, mas ainda um deploy essencialmente single-tenant em uso (mesmo com a arquitetura multi-tenant por baixo).
4. **Fase SaaS**: nesse ponto, **clona-se código + banco** para um novo projeto/ambiente SaaS. A partir da clonagem, **o projeto do Cauã congela** — só recebe correções de bug que façam sentido replicar pros dois lados (Cauã e SaaS), nenhuma feature nova. Todo o trabalho de SaaS de verdade (Super Admin VLUMA, cadastro automático de novo cliente/tenant, cobrança, resolução de tenant por subdomínio real, etc.) evolui **só no clone**, sem arriscar o ambiente de produção do cliente pagante.
5. **SaaS pronto** → decisão futura (não tomada agora): migrar o Cauã pra rodar dentro da plataforma SaaS unificada, ou mantê-lo standalone indefinidamente.

**Por quê clonar em vez de evoluir o mesmo ambiente direto pra SaaS:** o Cauã é cliente pagante rodando em produção nesse ponto — mudanças estruturais de SaaS (novo onboarding, billing, multi-tenant real) têm risco de regressão alto demais pra testar direto contra o ambiente de quem já depende do sistema no dia a dia. Clonar isola o risco.

#### Questões a resolver na Fase SaaS (decididas em 01/08/2026 — a construir no clone, não agora)

**📐 Registradas em 01/08/2026, sem implementação nenhuma ainda — fica para a Fase SaaS (item 4 acima), depois do Cauã congelar.** Três frentes fechadas como escopo da fase, para não perder o fio da meada quando essa fase começar:

1. **Onboarding de comerciantes**: fluxo self-service de cadastro de lojista — o comerciante se cadastra, cria a loja, o sistema provisiona o tenant automaticamente (linha em `tenants`, configuração inicial de `store_settings`, etc.), sem intervenção manual da VLUMA. Hoje `handle_new_user()` (migration `006`) hardcoda `tenant = 'capua'` no signup (ver nota já registrada acima, no início de §2) — na Fase SaaS isso vira dinâmico, resolvido pelo contexto do cadastro (qual loja o comerciante está criando), não mais uma constante fixa no código.
2. **Acesso por subdomínio nosso OU domínio próprio do cliente**: toda loja nova ganha um subdomínio padrão (ex.: `loja.vluma.com.br`) automaticamente no onboarding (item 1); lojistas mais avançados podem apontar um domínio próprio via CNAME (padrão de mercado — Shopify, Nuvemshop). Isso exige **resolução de tenant por host** (subdomínio ou domínio → `tenant_id`) no servidor, uma peça de infraestrutura nova — `src/lib/tenant.ts` já isola esse ponto de decisão no código (hoje retorna uma constante), mas a lógica real de resolver por host ainda não existe.
3. **Acesso do cliente-final da loja**: o consumidor final de cada loja acessa a vitrine pública através do subdomínio ou domínio daquela loja específica (uma das duas opções do item 2) — é a camada de storefront público, container onde o cliente-final efetivamente compra.

**Vínculo com a Vitrine (não é só Fase SaaS — chega antes):** a resolução de tenant por host do item 2 **não é exclusiva da Fase SaaS** — já é pré-requisito da fase da **Vitrine** (catálogo público, ver §4 "Planejadas"), bem antes do Cauã congelar. Essa é exatamente a "Opção C" já registrada em §2 "Padrão de multi-tenant nas escritas" (leitura pública via RPC/view parametrizada por tenant, resolvido no servidor a partir do subdomínio) — ou seja, parte da infraestrutura de resolução de tenant por host que a Fase SaaS precisa (item 2) já vai existir, em versão simplificada (só subdomínio nosso, sem domínio próprio de cliente ainda), desde a construção da Vitrine. A Fase SaaS estende essa mesma peça pra também aceitar domínio próprio do cliente (CNAME) e pro fluxo completo de onboarding (item 1).

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
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` — Base UI não tem primitivo de sortable; dnd-kit é o padrão de mercado, acessível, sem dependência de Radix |
| Deploy | Vercel |

### Padrão de autenticação (importante, decisão custosa de descobrir)

A sessão Supabase é gravada em cookie **`httpOnly: true`** (proteção contra roubo de token via XSS). Consequência arquitetural que se propaga por todo o painel:

- **O client Supabase do navegador (`src/lib/supabase/client.ts`) nunca enxerga a sessão** (JS não lê cookie httpOnly). Qualquer chamada feita direto do browser roda como usuário **anônimo**.
- Por isso, **login e logout são Route Handlers** (`/api/auth/login`, `/sair`), não Server Actions nem client calls — só o servidor lê o cookie.
- Login usa o padrão **POST → 303 See Other** com o `Set-Cookie` anexado à **mesma resposta de redirect** (`NextResponse.redirect` construído *antes* do `signInWithPassword`, cookies gravados via `response.cookies.set` dentro do `setAll`). Anexar cookie a um `NextResponse.redirect` criado separadamente do `cookieStore` **não propaga o `Set-Cookie`** — bug real já caçado e corrigido.
- **Logout precisa ser POST, nunca GET.** O Next.js faz *prefetch* automático de `<Link>` visíveis na viewport; um `GET /sair` que efetua `signOut()` é derrubado pelo próprio prefetch do framework, matando a sessão sem o usuário clicar em nada. Bug real, também já caçado.
- **Toda tela do painel que precisa ler dados além do que a RLS libera para `anon`/leitura pública (ex.: categorias inativas, criar/editar registros) passa por Route Handlers em `/api/painel/<entidade>`**, que usam o client server-side (`src/lib/supabase/server.ts`, lê o cookie via `cookies()` do `next/headers`, autenticado de verdade). Os hooks TanStack Query do painel fazem `fetch()` contra essas rotas — **não** chamam `supabase.from(...)` direto do browser. Esse é o padrão fixado para todo CRUD administrativo daqui pra frente.
- `src/proxy.ts` (renomeado de `middleware.ts` na convenção do Next 16) é **somente leitura**: nunca grava cookie, só decide redirect (`/entrar` ↔ `/painel`) a partir da sessão já existente.

**⚠️ Pendência reportada em 01/08/2026, não confirmada por teste ainda — sessão expirando (~1h) sem renovação, impacto no Cauã em produção.** Achado ao reler o código (não reproduzido ao vivo nesta sessão — a suspeita inicial de expiração durante o teste de Produtos se mostrou ser outra causa, um bug no script de teste clicando no botão errado, não isso). O que o código mostra:
- `proxy.ts` tem `setAll()` **intencionalmente vazio** ("proxy nao renova nem grava cookies" — comentário no próprio arquivo).
- `src/lib/supabase/server.ts` tem um comentário que diz o oposto: "Server Component: ignorado, middleware cuida da renovação" — mas o middleware (`proxy.ts`), como acabamos de confirmar, **não cuida** de renovação nenhuma. Os dois comentários se contradizem.
- Combinado, isso sugere que **nenhuma camada do app renova o token proativamente** fora de um Route Handler específico que já esteja fazendo outra operação Supabase. Um staff que navega só por Server Components (sem disparar POST/PATCH) por mais tempo que o access token dura pode, em tese, cair sem aviso.
- **Não investigado**: se o refresh token do Supabase está configurado com rotação (nesse caso, tentativas de refresh "descartadas" — nunca persistidas de volta no cookie pelo `setAll` vazio — podem invalidar o refresh token depois de algumas tentativas, tornando o problema pior). Precisa checar a configuração de Auth do projeto Supabase e, idealmente, reproduzir o logout de verdade (deixar uma aba do painel aberta e parada por >1h, ou ajustar a duração do JWT em ambiente de teste pra acelerar) antes de decidir a correção.

### Padrão de multi-tenant nas escritas

Colunas `tenant_id` ganham `DEFAULT public.current_tenant_id()` (função SQL que resolve o tenant do usuário autenticado via `profiles`/`customers`). Assim nenhum Route Handler precisa descobrir/hardcodar o tenant no `insert()` — já feito para `delivery_cities` (migration `008`), `categories` (migration `010`) e `category_attributes` (migration `012`); qualquer tabela nova gerida pelo painel deve repetir o padrão. `products` e `product_variants` tinham esse mesmo gap desde as migrations `003`/`009` (nunca corrigido, só notado ao planejar o CRUD de Produtos) — corrigido na migration `015` (renumerada de `013` — ver §6).

**⚠️ Gap de isolamento multi-tenant identificado em 30/07/2026:** `is_admin()`/`is_staff()` (`002_core.sql`) são checagens **globais**, não filtram por `tenant_id`. Nenhuma policy de RLS de escrita staff hoje (`categories_staff_write`, `products_staff_write`, `product_variants_staff_write`, `category_attributes_staff_write`, etc.) restringe por tenant — só exige `is_staff()`. Hoje é inofensivo porque existe um único tenant (`capua`); mas antes de um segundo tenant entrar, **todas as policies `*_staff_write` precisam ganhar `and tenant_id = current_tenant_id()`** (ou equivalente), senão staff de um tenant enxergaria/escreveria dados de outro via PostgREST direto. As RPCs `gerar_codigo_produto` e `criar_produto_com_variacoes` (migration `016`) já fazem essa checagem explicitamente no corpo da função (obrigatório ali por serem `SECURITY DEFINER`, que ignora RLS) — mas isso não substitui o conserto das policies em si.

**Revisado em 31/07/2026 — corrigido em `013_rls_tenant_isolation.sql` (criada e commitada, aguardando aplicação):** todas as policies de leitura privilegiada/escrita staff listadas acima, mais `tenants_admin_all`, `profiles_*`, `customers_*`, `settings_admin_write`, `pfv_staff_write`, `images_staff_write`, `price_history_staff_select`, `cities_*`, ganharam `and tenant_id = current_tenant_id()`. Também corrige a RPC `set_category_ativo_cascade` (migration `011`, **já aplicada em produção**), que tinha o mesmo gap (aceitava `category_id` de qualquer tenant). Detalhe completo em §6.

**Leitura pública (anon) fica de fora, de propósito — vínculo com a futura Vitrine:** RLS não consegue restringir por tenant um visitante anônimo (sem sessão, `current_tenant_id()` não resolve nada pra ele). Isso vale em especial para `store_settings` (`settings_select_public` usa `using (true)`, hoje devolve a configuração de **todos** os tenants pra qualquer `anon`) — fica assim deliberadamente até a Vitrine existir. **Quando a Vitrine for construída, toda query pública que ler `store_settings`, `categories`, `products` etc. precisa filtrar `tenant_id` explicitamente na query da aplicação** (via `src/lib/tenant.ts`, resolvendo o tenant pelo subdomínio) — a mesma nota já registrada como requisito futuro na decisão #9 (visibilidade de categoria inativa na vitrine) se estende a `store_settings` e a toda leitura pública.

**⚠️→✅ Vazamento REAL confirmado por teste em 31/07/2026, corrigido em `014_rls_select_anon_authenticated_split.sql` (✅ aplicada e validada em 31/07/2026 — ver resultado do reteste logo abaixo):** ao testar o isolamento com o tenant sintético (`supabase/tests/isolamento_test.sql`, depois da `013` aplicada), o staff do tenant de teste enxergava as categorias **ativas** do Cauã (vazamento real, não hipotético). Causa raiz: as policies `*_select_public` da `013` valiam para `anon` **e** `authenticated` com a mesma condição `ativo = true or (is_staff() and tenant_id = current_tenant_id())` — como RLS faz OR entre policies aplicáveis, a branch `ativo = true` (sem tenant nenhum) sozinha já bastava pra qualquer sessão `authenticated` (staff **ou cliente final logado**, achado extra desta investigação) ver toda linha ativa de **qualquer** tenant. A branch de escrita (`*_staff_write`) nunca teve esse problema (só é consultada em INSERT/UPDATE/DELETE) — o vazamento era exclusivamente de leitura.

**Correção (Opção A, decidida em 31/07/2026):** a policy de SELECT de cada tabela afetada (`categories`, `category_attributes`, `products`, `product_variants`, `delivery_cities`, `store_settings`, `product_attribute_values`, `product_images`) foi separada em **duas policies distintas** por tabela — uma pra `anon` (mantém `ativo = true` / `using(true)` sem filtro de tenant, é a leitura pública da vitrine) e uma pra `authenticated` (sempre `tenant_id = current_tenant_id()`, sem nenhum escape hatch — nas tabelas com coluna `ativo`, mais `and (ativo = true or is_staff())` pra staff continuar vendo inativo do próprio tenant no painel). Detalhe completo em §6.

**✅ Resultado do reteste, 31/07/2026 — isolamento provado, não só implementado:** depois de aplicar a `014`, o script `supabase/tests/isolamento_test.sql` foi rodado de novo com o mesmo tenant sintético (canário). Antes da `014`: staff do tenant de teste via `categorias_do_caua_que_vejo = 6` (todas as categorias ativas do Cauã, vazamento real). Depois da `014`: `categorias_do_caua_que_vejo = 0`, `categorias_visiveis = 1` (só a própria categoria do tenant de teste). **Dois vazamentos distintos foram identificados e corrigidos nesta investigação**: (1) **staff cross-tenant** — staff de um tenant lendo dados de outro (o achado original, que motivou o teste); (2) **cliente final logado cross-tenant** — um cliente autenticado (não-staff) também conseguia ler o catálogo ativo de outro tenant pela mesma policy tenant-blind, achado incidental durante a mesma investigação. Ambos fechados pela mesma migration `014` (a condição `tenant_id = current_tenant_id()` no topo da policy `authenticated` bloqueia os dois casos igualmente, já que nenhum dos dois tem `is_staff() = true` de outro tenant). Isolamento por tenant agora é **testado e comprovado**, não só desenhado — combinação das migrations `013` (escrita/leitura privilegiada) + `014` (leitura pública vs. autenticada).

**⚠️→✅ TERCEIRO vazamento diagnosticado e corrigido em 01/08/2026 (view, não policy) — migration `018_products_com_status_security_invoker.sql` aplicada e validada:** depois de fechar os dois vazamentos de tabela acima (`013`/`014`), ficou uma discrepância visível no painel de Produtos — a listagem (`/painel/produtos`, que consulta a view `products_com_status`) mostrava produtos do tenant sintético `_teste_isolamento` pra staff do Cauã, enquanto a tela de edição de produto (que lê `products` diretamente, sem passar pela view) isolava corretamente. Causa raiz: views do Postgres, por padrão, executam com os privilégios de quem as **criou**, não de quem as **consulta** — isso faz a view ignorar o RLS de `products`/`categories`/`product_variants` por completo, mesmo com as policies de `013`/`014` corretas e em vigor nas tabelas de base. Diagnóstico confirmado via `select relname, reloptions from pg_class where relname = 'products_com_status'` retornando `reloptions = null` (nunca teve `security_invoker` habilitado, nem na criação original na `009` nem na redefinição da `016`). Correção: `alter view ... set (security_invoker = true)`, fazendo a view herdar o RLS de quem consulta. Levantamento em toda a árvore de migrations confirma que `products_com_status` é a **única view** do projeto — não havia outras views/materialized views a corrigir na mesma migration. **✅ Aplicada pelo usuário em 01/08/2026** — `reloptions` reconferido no banco (`security_invoker=true`), e o reteste de isolamento com o canário `_teste_isolamento`, desta vez consultando a view diretamente (não só as tabelas), confirmou `de_outro_tenant=0`. Isolamento por tenant agora cobre tabela **e** view.

**📐 Aprendizado de processo registrado em 01/08/2026 — views sobre tabelas com RLS precisam de `security_invoker` explícito:** o Postgres não propaga RLS pra view automaticamente; o comportamento padrão (`security_invoker=false`, implícito) faz a view rodar com o privilégio de quem a criou, ignorando qualquer policy da tabela de base — isso não aparece em nenhum teste de policy isolada, só se manifesta na hora de consultar a view de verdade (foi exatamente assim que o vazamento da `products_com_status` passou despercebido desde a criação, migration `009`). **Regra adotada daqui pra frente**: toda `CREATE VIEW`/`CREATE OR REPLACE VIEW` nova sobre tabela protegida por RLS deve incluir `security_invoker = true` explicitamente na definição (`create view nome with (security_invoker = true) as ...`), no mesmo commit que cria a view — não como correção posterior. Mesma lógica já aplicada ao padrão `DEFAULT current_tenant_id()` em colunas novas (ver "Padrão de multi-tenant nas escritas" acima): a garantia de isolamento não pode depender de alguém lembrar de configurar depois.

**Opção C (fortalecida em 31/07/2026) — requisito obrigatório da fase Vitrine:** a nota acima ("app filtra `tenant_id` na query") deixa de ser suficiente sozinha como estratégia de longo prazo — depender de toda query pública lembrar de filtrar é exatamente a classe de risco que a Opção A acabou de eliminar pro lado `authenticated`. **Quando a Vitrine for desenhada, a leitura pública (`anon`) deve passar por RPC ou view parametrizada por tenant** (ex.: `get_public_categories(p_tenant_slug text)`), com o tenant resolvido no servidor a partir do subdomínio (`src/lib/tenant.ts`) e filtrado **dentro** da função/view — não confiar em cada Route Handler lembrar de acrescentar `.eq('tenant_id', ...)` manualmente. Isso centraliza a garantia de isolamento num único lugar revisável, em vez de espalhar a responsabilidade por N call sites futuros. Este é um requisito de design a resolver **no início do trabalho da Vitrine**, não depois.

**`handle_new_user()` (migration `006`) fica fora do escopo desta correção, de propósito:** hardcoda `tenant = 'capua'` no signup — não é vazamento (não expõe dado de outro tenant), é uma premissa single-tenant deliberada do MVP. Vira tema da **Fase SaaS** (decisão #22: resolver o tenant pelo contexto do cadastro/subdomínio no onboarding de um novo cliente), não desta migration de isolamento.

### Tenant sintético de teste (canário de isolamento)

**📐 Decidido em 31/07/2026 — ✅ criado e validado em uso na mesma data.** Serve pra validar de verdade o isolamento multi-tenant enquanto só existe o Cauã em DEV, e já cumpriu isso: foi o canário que **encontrou o vazamento real** documentado logo acima (leitura cross-tenant via a branch pública das policies de SELECT).

- **Nunca faz parte da cadeia de `supabase/migrations/`** — não é schema, é dado de teste. Criado via script `supabase/tests/isolamento_test.sql` (linha em `tenants` + linha em `profiles` associada a um usuário real do Supabase Auth criado manualmente pra este fim), fora de qualquer arquivo de migration versionado. Isso garante que ele **nunca é clonado pra produção nem pro clone da Fase SaaS** (decisão #22) — a cadeia de migrations é exatamente o que se replica nesses dois casos.
- **Identificação inequívoca**: `slug = '_teste_isolamento'`, `nome` contendo explicitamente "TESTE" (ex.: "TESTE — Canário de Isolamento").
- **`tenants.ativo = false`**: mantém o tenant de teste fora de `tenants_select_public` (`using (ativo = true)`) e de qualquer futura listagem/métrica que já filtre por tenant ativo — sem precisar de coluna nova. Não afeta a autenticação/RLS do tenant em si (`is_staff()`/`current_tenant_id()` não checam `tenants.ativo`), então continua 100% funcional pra testar isolamento.
- **Mantido permanentemente** como canário de regressão (não descartado após o primeiro teste) — decisão explícita: reaproveitar pra qualquer mudança futura de RLS/multi-tenant.
- **✅ Confirmado em uso, 31/07/2026**: o mesmo canário (usuário `8c0c4252-a38e-406f-94f7-a6f2aa3b7dcb` no tenant `_teste_isolamento`) foi reaproveitado pra retestar depois da migration `014` — sem precisar criar nada novo — e confirmou o fechamento do vazamento (`categorias_do_caua_que_vejo` caiu de 6 pra 0). Continua de pé como canário permanente pra qualquer mudança futura de RLS/multi-tenant.
- **Regra geral daqui pra frente**: qualquer tela/consulta futura que liste ou conte dados entre tenants (dashboards, métricas, Super Admin VLUMA) deve excluir tenants inativos/de teste — já é o comportamento padrão de tudo que filtra por `ativo = true`, só reforçando aqui que o canário depende disso pra nunca aparecer nas telas do Cauã.

### Padrão de mensagens de erro (voltadas ao usuário)

**✅ Em vigor a partir de 30/07/2026** — aplicar em toda funcionalidade nova; retroaplicar às existentes quando conveniente. Regra completa em `REGRAS_DE_NEGOCIO.md` §9: português claro, orienta a próxima ação, zero jargão técnico (nada de código de erro Postgres, nome de constraint/tabela/coluna, "RPC", stack trace). Detalhe técnico completo continua existindo — só que **apenas em log de servidor/console**, nunca na tela do usuário.

Catálogo de mensagens da feature **Código do Produto** (migration `016`, renumerada de `014`), como referência de implementação para os Route Handlers de `/api/painel/produtos` (ainda não escritos — Etapa 1 em andamento):

| Situação técnica | Mensagem ao usuário |
|---|---|
| Categoria sem `prefixo_codigo` | "Esta categoria ainda não tem um prefixo de código. Abra o cadastro da categoria e salve para gerá-lo." |
| `category_id` inexistente ou de outro tenant | "Categoria não encontrada." |
| Nenhuma variação enviada na criação | "Adicione pelo menos uma variação para o produto." |
| Colisão `unique(tenant_id, codigo)` (código manual) | "Já existe um produto com este código. Escolha outro." |
| Colisão `unique(tenant_id, slug)` | "Já existe um produto com esse nome. Ajuste o nome." |
| Colisão `unique(tenant_id, sku)` em variação | "Já existe uma variação com este SKU. Ajuste o SKU." |
| `chk_variant_preco_promo` (promo ≥ preço) | "O preço promocional deve ser menor que o preço normal." |
| `chk_variant_preco`/`chk_variant_estoque`/`chk_variant_qtd_min` | "O preço/estoque não pode ser negativo." / "A quantidade mínima deve ser pelo menos 1." |
| Colisão `unique(tenant_id, prefixo_codigo)` (prefixo manual na categoria) | "Já existe uma categoria com este prefixo. Escolha outro." |
| Tentativa de alterar `codigo` após criado | "O código do produto não pode ser alterado depois de criado." |
| Erro genérico/não mapeado | "Não foi possível salvar o produto. Tente novamente." |

As mensagens acima já estão implementadas nas RPCs `gerar_codigo_produto` e `criar_produto_com_variacoes` (via `raise exception` com texto amigável, capturando `unique_violation`/`check_violation` e traduzindo pelo nome da constraint). As linhas de colisão de slug/prefixo de categoria dependem dos Route Handlers ainda não escritos — devem seguir esta tabela literalmente quando implementados.

### Padrão de CRUD administrativo (fixado a partir de Cidades, replicado em Categorias)

- Listagem com filtro de **status** (Ativos/Inativos/Todos) e **busca por nome**, ambos sincronizados na **URL** via `useQueryParamState` (sobrevive a reload, compartilhável por link).
- Criação/edição sempre em **modal** (`Dialog`), nunca página separada — `FormDialog` genérico em `components/painel/crud/`.
- **Soft delete universal**: nenhuma entidade do painel sofre `DELETE` real. Existe um campo `ativo`; "excluir" = inativar. Confirmação (`ConfirmDialog`) só é pedida ao **inativar** (ação com efeito colateral); reativar é instantâneo (exceto quando reativar também tem efeito em cascata — ver Categorias).
- Toast (`sonner`) em toda mutation (criado/atualizado/inativado/reativado).
- Validação client-side (Zod) **e** server-side (Zod de novo, no Route Handler) — o client nunca é a única linha de defesa.
- Componentes genéricos reutilizáveis em `components/painel/crud/`: `StatusFilterTabs`, `SearchInput`, `StatusBadge`, `ConfirmDialog`, `FormDialog`. Primitivo `components/ui/combobox.tsx` (Base UI, select com busca) para seletores com listas grandes (ex.: categoria-pai).
- **`Sheet` (painel lateral) é o padrão quando abrir a gestão de uma sub-lista que por sua vez precisa de modais próprios** — evita aninhamento de `Dialog` dentro de `Dialog`. Usado em Características de categoria (`caracteristicas-sheet.tsx`): o Sheet lista/reordena, e o `FormDialog` de criar/editar característica abre *sobre* ele. Filtro/busca/URL-state não são obrigatórios nessa tela — aplicar onde o volume de dados justifica (lista curta por categoria não precisa).
- **📐 Planejado, não implementado:** toda ação de escrita (criar/editar/inativar/reativar) deve chamar um helper `registrarAuditoria()` a partir do Route Handler, gravando em `audit_log` — ver "Auditoria" logo abaixo e decisão #15.

### Auditoria (planejada — 📐 decidida, não implementada)

Tabela genérica `audit_log`: `tenant_id`, `usuario_id`, `acao`, `entidade`, `entidade_id`, `dados_antes jsonb`, `dados_depois jsonb`, `timestamp`. **Registro feito na aplicação** (helper `registrarAuditoria()` chamado explicitamente por cada Route Handler de escrita), **não via trigger de banco** — a decisão foi deliberada: um trigger só vê o `UPDATE` cru na tabela, sem o contexto de negócio (ex.: "esta inativação foi uma cascata disparada a partir da categoria X", "por qual usuário/sessão"), que só a camada de aplicação tem no momento da ação. Isso amarra diretamente com a cascata de categorias (decisão #8): quando a inativação em massa acontecer, o audit_log é o que permite ao Super Admin reconstruir *por que* várias categorias mudaram de status de uma vez.

Propósito: rastreabilidade para o **Super Admin VLUMA** (não para o admin comum do tenant, que não tem acesso a isso) — ver §4 "Planejadas (não iniciadas)", item Super Admin VLUMA. Candidata a feature premium monetizável no SaaS.

---

## 3. Modelo de dados atual

> Tabelas conforme aplicadas até a migration `012` (todas confirmadas aplicadas no banco — ver seção 6).

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
| `categories` | Árvore de categorias via `parent_id` (auto-FK, N níveis). `parent_id = null` → raiz. `slug` único por tenant (namespace global, não por parent — decisão de produto). `inativado_em_cascata` (migration `011`) marca linhas derrubadas por cascata a partir de um ancestral — ver decisão #8 e RPC `set_category_ativo_cascade`. |
| `category_attributes` | Ficha técnica / filtros configuráveis por categoria — "Características" na interface (substituiu `subcategory_fields`). `tipo`: `texto \| numero \| selecao \| booleano \| data` (enum `field_type`; valor `'lista'` renomeado para `'selecao'` na 009; UI só expõe os 4 primeiros). `opcoes` (jsonb, array de strings) quando `tipo=selecao`. `chave` gerada uma única vez na criação (nunca muda depois, mesmo editando `rotulo`) — identificador interno estável. **CRUD completo em `/painel/categorias` → botão "Características" (Sheet lateral)**, com reordenação por drag-and-drop (`@dnd-kit`). |
| `products` | Produto de vitrine: `nome`, `slug`, `descricao`, `category_id`, `unidade_venda`, `destaque` (curadoria manual), `ativo`. **Sem preço nem estoque** — isso vive na variação. |
| `product_variants` | SKU do produto (substituiu os campos de preço/estoque que existiam direto em `products`). `nome` (rótulo, ex. "1kg"), `sku`, `preco`, `preco_promocional` (nullable, `check` garante `< preco`), `modo_estoque` (`quantitativo \| disponibilidade`), `saldo_estoque`, `quantidade_minima`, `ativo`. Produto simples = 1 variant "Padrão"; produto com tamanhos = N variants. |
| `product_attribute_values` | Valor de um `category_attributes` para um produto específico (substituiu `product_field_values`). |
| `product_images` | Fotos do produto (ligadas a `product_id`, compartilhadas entre variações — per-variant image é extensão futura). |
| `product_price_history` | Histórico de preço, agora por **variação** (`variant_id`, com `product_id` denormalizado pra listar o histórico do produto inteiro sem join). Trigger `log_variant_price_change()` dispara em `INSERT/UPDATE OF preco ON product_variants`. |

**Status derivado, não armazenado** (view `products_com_status`, criada na `009`): `esgotado` (soma de `saldo_estoque` das variações ativas = 0), `em_promocao` (existe variação ativa com `preco_promocional < preco`), `novidade` (`created_at` recente), `preco_a_partir_de` (menor preço entre variações ativas). Não existe coluna de "cor"/flag manual de status — é sempre calculado em query.

`subcategories` e `subcategory_fields` **foram removidas** (dropadas na `009`, sem necessidade de migrar dados — ambiente de dev sem catálogo real).

### Codificação de produtos — Código vs SKU (planejada — 📐 decidida, não implementada)

**⏸️→✅ Em espera desde 31/07/2026, liberada em 31/07/2026:** migrations `015`/`016` (renumeradas de `013`/`014` — ver §6) foram criadas e commitadas depois de resolver primeiro o isolamento total por tenant (`013_rls_tenant_isolation.sql` + `014_rls_select_anon_authenticated_split.sql`, decisão #21) — nessa ordem, como planejado. **Ambas aplicadas e validadas em 31/07/2026** (colunas/tabela/RPCs conferidas presentes no banco, `src/types/database.ts` atualizado, `npm run build` passou). O modelo abaixo já existe no banco.

Decisão de produto fechada em 30/07/2026 (ver decisão #18 em §5), registrada antes de iniciar o CRUD de Produtos. Formaliza dois identificadores distintos:

- **Código** — por *produto*: identificação/referência, pensado inclusive para lojistas migrando de outro sistema que já têm códigos próprios. Prefixo vem sempre da **categoria** do produto, nunca de um prefixo genérico de loja. Visibilidade na vitrine é configurável (toggle) — quando visível, aparece na ficha do produto e é buscável pelo cliente.
- **SKU** (`product_variants.sku`, já modelado na `009`) — por *variação*: controle de estoque, uso interno/discreto, sem seletor automático/manual.

Regras do Código:

1. Prefixo definido no cadastro da categoria (`categories.prefixo_codigo`, novo campo, opcional). Vazio → derivado automaticamente do nome (ex. "Ciclídeos" → `CIC`), mostrado pré-preenchido no formulário da categoria para o lojista ajustar se quiser (transparência, não é caixa-preta).
2. Prefixo único por tenant; colisão na derivação automática exige ajuste do sistema ou confirmação do lojista.
3. Formato `PREFIXO-NNNN` — sequência numérica com zeros à esquerda, **contada por categoria** (cada categoria começa do zero: `CIC-0001`, `CIC-0002`; `RAC-0001`...).
4. Gerado na criação do produto; **imutável depois** — mesmo que o produto mude de categoria, o código original permanece (preserva referência em pedidos já feitos e no histórico do cliente).
5. Lojista escolhe automático (regra acima) ou manual (campo editável, pré-preenchido com a sugestão automática) no cadastro do produto.

Modelagem afetada (nenhuma migration criada ainda):

- `categories.prefixo_codigo` (opcional; derivado do nome se vazio).
- `products.codigo` (imutável) + `products.codigo_visivel` (boolean, toggle de vitrine).
- Mecanismo de sequência por categoria (contador garantindo unicidade do código).
- SKU em `product_variants` permanece automático-editável, sem seletor (distinção reforçada acima).

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
| CRUD de Categorias em árvore | `/painel/categorias` | Árvore colapsável, busca com auto-expand preservando caminho até a raiz, combobox de categoria-pai com exclusão anti-ciclo (client **e** servidor) |
| Características de categoria | Botão "Características" na árvore abre `Sheet` lateral (`caracteristicas-sheet.tsx`) com lista reordenável (`@dnd-kit`) + `FormDialog` de criar/editar. Migration `012` (`category_attributes.tenant_id` ganha `DEFAULT`) | Nome, Tipo (texto/número/seleção/sim-não), Opções (quando seleção), Obrigatória, Usar como filtro, soft delete. `chave` auto-gerada e estável. Sem herança entre categorias nesta fase — modelo não impede adicionar depois (resolução via `parent_id` em tempo de consulta, ver `use-caracteristicas.ts`). Testado com Chromium real: criar, editar (opções pré-carregadas), inativar/reativar, drag-and-drop com persistência confirmada no banco |
| Fix do bug de slug trocado no modal de editar Categoria | `categoria-form-dialog.tsx` | Causa raiz real: `useState`/`defaultValues` estáticos do `react-hook-form` dependiam de um `reset()` em `useEffect` que corria contra o efeito de auto-slug. Corrigido inicializando os dois direto de `categoria` (lazy init + `defaultValues` computados) **e** `key={categoria?.id}` no ponto de renderização. Testado com Chromium real: 4 edições seguidas em categorias diferentes, slug correto em todas |
| Cascata de inativação/reativação de Categorias | Migration `011` (`inativado_em_cascata` + RPC `set_category_ativo_cascade`, atômica, com checagem `is_staff()` própria) + `ConfirmDialog` de inativar (conta descendentes ativos) e de reativar (conta descendentes cascateados, só aparece se > 0) | Testado com Chromium real contra o banco: filha já inativa por decisão própria não é tocada por nenhum dos dois sentidos; filha ativa é cascateada e depois restaurada corretamente |
| Fix da colisão de prefixo em nomes compostos de Categoria | `categoria-form-dialog.tsx`, `route.ts` (POST/PATCH de `/api/painel/categorias`) | Causa raiz real: o formulário sempre pré-preenchia o campo prefixo com a derivação automática antes do submit, então o servidor tratava qualquer save como "prefixo digitado manualmente" e nunca tentava o auto-sufixo em caso de colisão — categorias com nomes parecidos (ex.: categoria-mãe "Betas" e subcategoria "Beta Azul", ambas derivando pra `BET`) ficavam com `prefixo_codigo = null` para sempre: qualquer save (mesmo sem mudar nada) falhava com "Já existe uma categoria com este prefixo", travando a linha inteira (não só o prefixo — nenhum outro campo da categoria conseguia ser salvo junto). Esse era o mesmo bug relatado inicialmente como aparente duplicidade de "nome" ao editar sem mudar nada — investigação com Chromium real mostrou que a mensagem exibida era sempre sobre prefixo, e a causa era a mesma em ambos os casos. Corrigido: o formulário só envia o prefixo como "digitado" quando o usuário de fato editou o campo (`prefixoManual`); caso contrário manda vazio e deixa o servidor derivar e resolver a colisão sozinho. Sufixo de desempate mudou de incremento simples (`BET2`, `BET3`) para 4 dígitos colados (`BET0001`, `BET0002`...) — decisão do usuário em 01/08/2026. **Testado com Chromium real contra a URL pública, pós-deploy**: as categorias que estavam travadas (`prefixo_codigo = null` desde antes do fix) se auto-curaram na primeira edição depois do deploy, sem precisar de migration de dados — "Beta Azul" ganhou `BET0001`, "Beta Negro" ganhou `BET0002` (resolvido automaticamente contra o `BET0001` que "Beta Azul" acabara de reservar), "Ração de Superfície" ganhou `RAC0001`. Uma categoria a mais no mesmo estado (`Ração para Peixes de Fundo`, `prefixo_codigo = null`) não foi tocada no teste — deve se autocurar da mesma forma na próxima vez que alguém salvar seu cadastro, sem ação manual necessária. **Auditoria adicional em 02/08/2026** (reconfirmando a hipótese original do usuário — "a validação deveria excluir o próprio id"): varredura completa de Categorias, Cidades, Produtos e Unidades de Venda (Route Handlers + RPCs) não encontrou **nenhum** código de checagem manual de duplicidade em lugar nenhum das 4 entidades — toda unicidade é delegada a índices/constraints do Postgres, capturados via `unique_violation`/23505, e todo `UPDATE`/RPC de edição é sempre escopado por `where id = <id_do_próprio_registro>`. Um `UPDATE` de uma linha pro valor que ela já tinha não pode colidir com ela mesma por semântica pura de SQL — só colide se existir outra linha de verdade com o mesmo valor, que foi exatamente o caso do prefixo de categoria acima. Conclusão: a classe de bug "esqueceu de excluir o próprio id" **não existe** nesta base — o que parecia isso era sempre o mecanismo do prefixo |
| **Unidades de Venda (Melhoria 3)** | Cadastro `unidades_venda` por tenant (migration `019`) substitui o campo de texto livre do produto por seleção — `products.unidade_venda_id` (uuid, FK), Combobox no formulário de produto com auto-seleção de "Unidade" em produto novo, tela de gestão `/painel/unidades-venda` (padrão de Cidades: nome + ativo), Route Handlers `/api/painel/unidades-venda` + `[id]`. Seed inicial: Unidade, Dupla, Cardume, Kg, Litro, Pacote | **Testado com Chromium real contra a URL pública** em 01/08/2026: listagem confirmada com as 6 unidades do seed, criação e inativação de unidade de teste confirmadas (sem lixo em produção). Ver §0 itens 7–9 para o histórico do incidente de produção que motivou boa parte deste trabalho (migration `019` aplicada antes do frontend estar pronto) e seu fechamento |
| **Visualização read-only ao clicar na linha (Melhoria 4)** | Categorias e Produtos: clique na linha da listagem abre `CategoriaViewDialog`/`ProdutoViewDialog` (só leitura — categoria-pai/breadcrumb, slug, prefixo, descrição, status para categoria; código, categoria, unidade de venda, preço, tabela de variações para produto), com botão "Editar" que leva ao fluxo de edição de sempre (mesmo `CategoriaFormDialog`, mesma página `/painel/produtos/[id]`). Ações existentes (lápis, inativar/reativar, características, chevron de expandir) preservadas via `stopPropagation`. Linha ganha `tabIndex`/`onKeyDown` (Enter) para acessibilidade por teclado. Sem migration — mudança só de frontend | **Testado com Chromium real contra a URL pública** em 01/08/2026: clique na linha de categoria abre o modal com todos os campos esperados, "Editar" abre o form pré-preenchido corretamente; clique no lápis abre a edição direto, sem o modal de visualização por baixo (`stopPropagation` confirmado); mesmo roteiro em Produtos (modal com variações, "Editar" navega para a página de edição, lápis não dispara o modal) |
| **Módulo de Estoque — incremento 1 (listagem, movimentação, histórico)** | Migrations `021` (tabela `stock_movements` + RPC `registrar_movimentacao_estoque`, ledger com saldo assinado, `FOR UPDATE`, amarração tipo↔sinal via `check`, `revoke update(saldo_estoque)`) e `022` (RPCs de produto passam a gerar movimentação de inventário em vez de gravar saldo direto) aplicadas pelo usuário. Tela `/painel/estoque`: listagem de variações `quantitativo` de produtos **ativos** com status derivado (ok/abaixo do mínimo/esgotado), filtro de 4 posições + busca. Ação "Registrar movimentação" (Entrada/Saída/Ajuste/Devolução — Inventário reservado ao sistema) chama a RPC; Ajuste pede o novo saldo total (não o delta). Clique na linha abre histórico read-only (usuário nulo exibe "Sistema"). Route Handlers `/api/painel/estoque` (+`/movimentacao`, +`/[variantId]/historico`), hook `use-estoque.ts` | **Testado com Chromium real contra a URL pública** em 02/08/2026: criação de produto de teste, Entrada de estoque confirmada na listagem e no histórico (usuário real registrado, não "Sistema"), Ajuste sem motivo bloqueado com mensagem amigável, Ajuste com motivo aplicando o **saldo total** informado (não um delta), Saída maior que o saldo bloqueada com "Estoque insuficiente" sem travar a tela, filtro de 4 posições confirmado na URL. **1 bug real encontrado e corrigido durante o teste**: a listagem inicial filtrava só `product_variants.ativo`, não `products.ativo` — produto inativado (toggle rápido só mexe em `products.ativo`, nunca cascateia pra variação) continuava aparecendo na tela de dia a dia de Estoque; corrigido buscando produtos ativos primeiro. Ordenação também corrigida para `produto_nome, variacao_nome` (só por nome de variação colidia muito — "Padrão" se repete entre produtos). Produtos de teste limpos (inativados) ao final, listagem real fica vazia até o próximo produto ativo com estoque existir |
| **Módulo de Estoque — incremento 2 (campo "Estoque inicial" no formulário de produto) — ✅ módulo completo** | Campo do formulário de produto renomeado de "Estoque" (`saldo_estoque`, sempre editável) para "Estoque inicial" (`estoque_inicial`, opcional): editável em produto novo e em variação nova adicionada durante uma edição; em variação **já existente** na edição, vira exibição read-only do saldo atual, com nota "Estoque gerenciado em [Estoque](/painel/estoque)" linkando para o módulo — nunca mais editável por ali. Route Handlers de produto e schema do formulário atualizados para o payload `estoque_inicial`, batendo com o que a RPC (`022`) espera | **Testado com Chromium real contra a URL pública** em 02/08/2026, sem nenhum bug encontrado: produto novo criado com "Estoque inicial" = 15 → saldo 15 confirmado na listagem de Estoque e histórico mostrando `Inventário +15 (0→15)`, motivo "Estoque inicial no cadastro do produto", usuário real (não "Sistema"); edição do mesmo produto confirmou o campo da variação existente desabilitado, exibindo 15, com o link "Estoque" apontando pra `/painel/estoque`; variação nova ("Grande") adicionada durante a edição com "Estoque inicial" = 8 → saldo 8 confirmado na listagem e histórico com o mesmo padrão de movimentação `inventario`. Produto de teste limpo (inativado) ao final. **Com este incremento, o módulo de Estoque está completo**: modelagem (`021`/`022`), listagem/movimentação/histórico (incremento 1) e integração no cadastro/edição de produto (incremento 2) — todos aplicados e testados na URL pública |
| **CRUD de Produtos — Etapa 1 (núcleo)** | Pré-requisito: `prefixo_codigo` na tela de Categorias (auto-derivado, editável, colisão tratada). Listagem `/painel/produtos` (status/busca/categoria na URL, `products_com_status`). Cadastro `/painel/produtos/novo` em página dedicada (3 blocos: Dados básicos, Código com peek+seletor automático/manual, Variações com SKU automático) via RPC `criar_produto_com_variacoes` (migration 016). Edição `/painel/produtos/[id]` via RPC `atualizar_produto_com_variacoes` (migration 017) — código sempre read-only, variações sincronizadas por diff (soft delete das removidas). Migrations `015`–`017` aplicadas | **Testado com Chromium real** (canário `_teste_isolamento`) em 31/07–01/08/2026: categoria com prefixo, produto com código automático (peek + reserva real batendo), código manual, código manual duplicado (erro amigável confirmado), preço negativo, promo ≥ preço, impedir remover a última variação, SKU automático com colisão evitada (`TES-0001-PADR`, `TES-0001-GRAN`), edição com variação nova + variação removida (soft delete confirmado via `estoque_total` recalculado), inativar/reativar. **3 bugs reais encontrados e corrigidos durante o teste** (não hipotéticos — pegos ao vivo): (1) `preco_promocional` vazio virava `0` em vez de `null` por ordem errada num `z.union` (`Number('') === 0` em JS) — afetava todo produto criado sem promoção; (2) botões `Button` renderizados como `<Link>` via `render=` disparavam aviso de acessibilidade do Base UI, faltava `nativeButton={false}`; (3) `min="0"`/`min="1"` nos inputs de variação disparavam tooltip nativo do navegador em vez da mensagem estilizada do Zod — removidos para manter Zod como única fonte de validação, consistente com o resto do painel. `product_images` (Etapa 3, fotos) e `product_attribute_values` (Etapa 2, ficha técnica por categoria) **ainda não implementados** — fora do escopo desta etapa. **⚠️→✅ Correção, 01/08/2026: o teste acima rodou contra `localhost` (não pushado, não deployado) — commits só chegaram no `origin/main`/Vercel em 01/08/2026, depois que o usuário reportou 404 em produção.** **Re-teste contra a URL pública ✅ concluído em 02/08/2026**: teste dedicado (criar produto, `preco_promocional` vazio confirmado `null` não `0`, zero warnings de acessibilidade no console, validação Zod sem tooltip nativo do navegador, adicionar/remover variação com soft delete confirmado, busca na listagem, inativar/reativar) somado a toda a atividade cumulativa do resto da sessão (Bug 1/2, Unidades de Venda, Melhoria 4, módulo de Estoque) que já vinha exercitando CRUD de produto na URL pública repetidamente. **Etapa 1 de Produtos está 100% fechada e confirmada em produção** — falta só Características (Etapa 2, `product_attribute_values`) e Imagens (Etapa 3, `product_images`), ambas fora do escopo desta etapa desde o início. |

### Em andamento / decidido mas não implementado

| Item | Status |
|---|---|
| Dois níveis de fechamento da loja | Migration `007` **aplicada**; nenhuma UI consome `pedidos_abertos`/`mensagem_pedidos_fechados` ainda (tela de Configurações da loja é planejada, não iniciada) |

### Planejadas (não iniciadas)

- **Produtos com variações**: CRUD de `products` + `product_variants` + `product_images` + valores de atributos, reaproveitando o padrão de CRUD e o combobox de categoria. **✅ Etapa 1 (núcleo: listagem/cadastro/edição de produto+variações) concluída em 01/08/2026 — ver tabela "Concluídas" acima.** `product_images` (fotos, Etapa 3) e valores de atributos por produto (ficha técnica, Etapa 2) seguem planejados, não iniciados.
- **Codificação de produtos (Código vs SKU)**: ver decisão #18 e §3 "Codificação de produtos" — prefixo por categoria, sequência por categoria, código imutável, visibilidade configurável na vitrine. **✅ Implementado e testado em 01/08/2026** junto com a Etapa 1 do CRUD de Produtos.
- **Configurações da loja**: tela para `store_settings` (dois níveis de fechamento, valor mínimo de pedido, autocadastro, regra de baixa de estoque).
- **Vitrine** (`(loja)`, hoje vazio): catálogo público, ficha de produto, Open Graph dinâmico por produto.
- **Carrinho e checkout**: valor mínimo, quantidade mínima por variação, reserva/baixa de estoque atômica no Postgres.
- **Pedidos**: fluxo pendente → aceite (staff) → PDF → envio (WhatsApp/Evolution API, mencionado na visão original, não iniciado).
- **Importação em massa via CSV**: o catálogo real do cliente piloto tem **~1.000 itens** — cadastro manual produto a produto é inviável nessa escala. Importação de produtos/variações via CSV é planejada; fase exata a definir (provavelmente logo após o CRUD de Produtos existir).
- **Super Admin VLUMA**: camada pós-MVP, separada do painel do tenant — gestão multi-tenant (criação de novas lojas), métricas entre clientes, e consumidora do `audit_log` (decisão #15). Ainda não desenhada.
- **Manual do usuário/lojista**: entregável planejado para o final do desenvolvimento — gerado a partir de `docs/REGRAS_DE_NEGOCIO.md` (que já é escrito em linguagem clara, pensado pra isso desde a origem).
- **Documentos Legais e Aceite (LGPD)**: aceite obrigatório de Política de Privacidade e Termos de Uso no cadastro do cliente, registro do aceite (quem/quando/versão/IP) para comprovação, documentos versionados por tenant, páginas públicas linkadas no rodapé. Ver decisão #17 e `REGRAS_DE_NEGOCIO.md` §7. **Sequenciado para depois da vitrine (F4)**, já na fase de preparação para produção.

---

## 5. Decisões de produto já tomadas

| # | Decisão | Status |
|---|---|---|
| 1 | Catálogo em **árvore** de categorias (N níveis via `parent_id`), não dois níveis fixos | ✅ Implementado |
| 2 | Características de produto (ficha técnica/filtro) são **configuráveis pelo lojista por categoria** (`category_attributes`), não fixas no código | ✅ Implementado (`/painel/categorias`, Sheet "Características") |
| 3 | Produto tem **variações/SKU** (`product_variants`); preço, promoção e estoque vivem na variação, não no produto | Modelado; UI ainda não existe |
| 4 | Status de produto (esgotado, em promoção, novidade) é **sempre derivado em query**, nunca uma flag manual gravada | Modelado (view `products_com_status`) |
| 5 | Loja tem **dois níveis independentes de fechamento**: `loja_aberta` (Nível 1, loja inteira inacessível) e `pedidos_abertos` (Nível 2, catálogo visível mas checkout bloqueado) | ✅ Aplicado no banco (migration `007`); UI de configuração ainda não existe |
| 6 | **Soft delete universal**: nenhuma entidade do painel tem exclusão real; sempre campo `ativo` + filtro Ativos/Inativos/Todos | ✅ Implementado no padrão de CRUD |
| 7 | **Modal é o padrão** para toda criação/edição no painel; nunca página separada | ✅ Implementado |
| 8 | Inativar categoria com filhas ativas **cascateia** a inativação pela subárvore, marcando quem foi arrastado (`inativado_em_cascata`) pra permitir restaurar só essas na reativação; quem já estava inativo por conta própria não é tocado em nenhum dos dois sentidos. Ligado à decisão #15: é justamente esse tipo de ação (uma escrita que afeta N linhas por consequência de uma decisão sobre 1) que o `audit_log` vai existir para explicar depois | ✅ Implementado (migration `011` + RPC `set_category_ativo_cascade`) |
| 9 | Vitrine (quando construída) deve esconder da navegação uma categoria inativa **e toda a sua subárvore** | Registrado como requisito futuro (comentário em `src/lib/category-tree.ts`); nada a implementar ainda (vitrine não existe) |
| 10 | Slug é gerado automaticamente a partir do nome (editável) — na entrega final ao lojista, o campo de slug deve ficar **oculto/secundário** na interface (detalhe técnico de URL não deve poluir o cadastro do dia a dia de quem não é técnico) | Decidido; hoje o campo aparece visível e editável no modal de Categoria (uso interno/DEV) — ocultar é um ajuste de UX pendente antes da entrega ao cliente final |
| 11 | Arquitetura multi-tenant desde a primeira tabela, tenant fixo no MVP | ✅ Implementado (`tenant_id` + `current_tenant_id()` + RLS) |
| 12 | Sessão em cookie `httpOnly`; toda mutation autenticada do painel passa por Route Handler, nunca client Supabase direto do browser | ✅ Implementado, é o padrão fixado |
| 13 | Perfis de acesso: Admin (total) e Operador (cadastros + permissão granular `pode_aceitar_pedido`) | ✅ Modelado (`profiles.role`, `pode_aceitar_pedido`) |
| 14 | Anti-ciclo em árvores (categoria não pode ter como pai um descendente dela mesma) validado **no client** (combobox exclui opções) **e no servidor** (defesa em profundidade) | ✅ Implementado |
| 15 | **Auditoria** (`audit_log`): toda escrita do painel passa a chamar `registrarAuditoria()` na aplicação (não trigger de banco), pra capturar contexto de negócio (ex.: qual usuário, se foi cascata). Uso: rastreabilidade do Super Admin VLUMA, não do admin do tenant. Candidata a feature premium | 📐 Decidido; não implementado — ver §2, "Auditoria" |
| 16 | **Vocabulário de interface**: telas voltadas ao lojista usam "Características" (nunca "atributos") e "Variações" (nunca "SKU"/"variants") — termos técnicos ficam só no código/banco. Decisão de UX baseada em pesquisa de mercado (Nuvemshop/Shopify) | ✅ Já seguido no CRUD de Categorias (rótulo "Características"); aplicar também ao CRUD de Produtos — ver `REGRAS_DE_NEGOCIO.md` §4.1 |
| 17 | **Documentos Legais e Aceite (LGPD)**: aceite obrigatório (checkbox + links) de Política de Privacidade e Termos de Uso no cadastro do cliente; aceite registrado com quem/quando/versão/IP para comprovação; documentos **versionados por tenant** (nova versão pode exigir re-aceite); páginas públicas linkadas no rodapé; texto-base gerado por IA **com ressalva explícita de revisão jurídica obrigatória antes de produção**. Sequenciado para depois da vitrine (F4) | 📐 Decidido; não implementado — ver `REGRAS_DE_NEGOCIO.md` §7 |
| 18 | **Código do Produto**: identificação/referência do produto, distinta do SKU (que é da variação, para estoque). Prefixo vem da **categoria** (`categories.prefixo_codigo`, derivado do nome se vazio, ex. "Ciclídeos" → `CIC`, único por tenant). Formato `PREFIXO-NNNN`, sequência própria por categoria (cada uma começa do zero). Gerado na criação do produto, **imutável** mesmo que o produto mude de categoria. Lojista escolhe automático ou manual (editável — migração de outro sistema). Toggle `codigo_visivel` controla se aparece e é buscável na vitrine | ✅ **Implementado e testado com Chromium real em 01/08/2026** — migrations `015`/`016`/`017` aplicadas; telas de criação e edição do CRUD de Produtos (Etapa 1) concluídas — ver §3 "Codificação de produtos", tabela "Concluídas" em §4 e `REGRAS_DE_NEGOCIO.md` §4.6 |
| 19 | **Padrão de mensagens de erro**: toda mensagem voltada ao usuário final é em português claro, orienta a ação, nunca expõe jargão técnico (código de erro, nome de constraint/tabela, "RPC"). Detalhe técnico só em log de servidor. Vale para todas as features, não só Produtos | ✅ Decidido e em vigor a partir de 30/07/2026 — ver §2 "Padrão de mensagens de erro" e `REGRAS_DE_NEGOCIO.md` §9 |
| 20 | **Gap de isolamento multi-tenant em RLS**: policies de escrita staff (`*_staff_write`) checam só `is_staff()`, não `tenant_id` — staff de um tenant teoricamente acessaria dados de outro. Inofensivo hoje (1 tenant só); precisa ser corrigido antes do 2º tenant | ⚠️ Identificado, não corrigido — ver §2. **Revisado em 31/07/2026**: decidido corrigir AGORA, de forma completa, antes de seguir com Produtos — ver decisão #21 (levantamento completo de tabelas/policies/RPCs feito em sessão, plano apresentado, implementação ainda pendente de aprovação) |
| 21 | **Isolamento total por tenant priorizado antes de Produtos**: pausar o CRUD de Produtos (Etapa 1) e corrigir primeiro TODAS as policies de RLS e RPCs `SECURITY DEFINER` do projeto para restringir leitura/escrita por `tenant_id = current_tenant_id()`, não só `is_staff()`/`is_admin()`. Migrations `015`/`016` (Código do Produto, renumeradas de `013`/`014`) ficam em espera — ver §6 — até essa base estar pronta | 📐 Decidido em 31/07/2026; migration `013_rls_tenant_isolation.sql` aplicada. **Teste real com o tenant sintético encontrou um SEGUNDO vazamento** (leitura cross-tenant via branch pública das policies de SELECT, não coberto pela `013` — que só tratava escrita/leitura privilegiada) — corrigido em `014_rls_select_anon_authenticated_split.sql` (✅ **aplicada e validada em 31/07/2026** — reteste com o canário confirmou `categorias_do_caua_que_vejo = 0`, era 6 antes). Ver detalhe completo em §2 e §6. **Com o isolamento provado, as migrations `015`/`016` (Código do Produto) também foram aplicadas e validadas em 31/07/2026** — nenhuma migration pendente no momento; próximo passo é implementar o CRUD de Produtos (Etapa 1) em cima da base já isolada. |
| 22 | **Estratégia de evolução para SaaS**: isolar tenant agora → desenvolver Cauã sobre a base isolada → Cauã completo vai a produção como tenant único → clonar código+banco pra abrir a fase SaaS (Cauã congela, só bugfix compartilhado) → SaaS pronto decide se migra o Cauã pra plataforma ou mantém standalone | 📐 Decidido em 31/07/2026 — ver §1 "Estratégia de evolução para SaaS" |
| 23 | **Sufixo de desempate do prefixo de código**: quando o prefixo derivado automaticamente de uma categoria colide com o de outra já existente (mesmo tenant), o sistema desempata colando um número de 4 dígitos ao prefixo (`BET`, depois `BET0001`, `BET0002`...) em vez de um incremento simples de 1 dígito. ~~Mantém a derivação em si simples (3 primeiras letras do nome inteiro, sem dividir por palavras) — toda a responsabilidade de evitar colisão fica no sufixo, não numa regra de derivação mais elaborada~~ **Revisto no mesmo dia (01/08/2026)**: decisão trocada pela combinação das duas coisas — ver decisão #24 logo abaixo. O sufixo de 4 dígitos continua existindo como rede de segurança, mas agora é o segundo nível de defesa, não o único | ✅ Implementado e testado com Chromium real em 01/08/2026 — ver linha "Fix da colisão de prefixo..." na tabela "Concluídas" acima. **Revisto** — ver decisão #24 |
| 24 | **Derivação de prefixo por divisão de palavras (revisão da decisão #23)**: em vez de derivar sempre as 3 primeiras letras do nome inteiro, `derivarPrefixo()` agora considera o número de palavras do nome (ignorando conectores curtos: de/da/do/e/em/com) — 1 palavra → 3 primeiras letras (`Ciclídeos`→`CIC`, sem mudança); 2 palavras → 2 primeiras letras de cada (`Beta azul`→`BEAZ`); 3+ palavras → 2 letras da 1ª palavra + 1ª letra de cada palavra seguinte, até 4 caracteres (`Ração Filhotes Premium`→`RAFP`). Reduz a chance de colisão entre categoria-mãe e subcategoria com nome parecido (o caso real que motivou a correção: "Betas"→`BET` e "Beta Azul", que antes também derivava `BET`, agora deriva `BEAZ`) — mas não é garantia absoluta, então o sufixo numérico da decisão #23 continua como rede de segurança pros casos raros que ainda colidirem | ✅ Implementado em `src/lib/produto-codigo.ts` (`derivarPrefixo`) em 01/08/2026, build local validado. Categorias já autocuradas antes desta revisão (`Beta Azul`=`BET0001`, `Beta Negro`=`BET0002`, `Ração de Superfície`=`RAC0001`) **não são recalculadas automaticamente** — só ganhariam o prefixo "por palavras" se o lojista editar o campo prefixo manualmente de novo |

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

> **Ver `docs/MIGRATIONS.md`** para o mapa completo migration a migration (001–018, todas aplicadas e validadas), incluindo a explicação do número `014` que não existe na sequência original (renumeração da feature Código do Produto — nenhum conteúdo perdido, só o arquivo pulou de número).

| # | Arquivo | Aplicada? |
|---|---|---|
| 001–006 | núcleo, catálogo v1, RLS, cidades, provisionamento de usuário | ✅ |
| 007 | `store_settings_fechamento` (dois níveis de fechamento) | ✅ |
| 008 | `delivery_cities` ganha `DEFAULT current_tenant_id()` | ✅ |
| 009 | `catalog_v2` (árvore + atributos + variações) | ✅ |
| 010 | `categories` ganha `DEFAULT current_tenant_id()` | ✅ |
| 011 | `categories` ganha `inativado_em_cascata` + RPC `set_category_ativo_cascade` (cascata) | ✅ |
| 012 | `category_attributes` ganha `DEFAULT current_tenant_id()` | ✅ |
| 013 | `rls_tenant_isolation` — isolamento total por tenant: todas as policies de leitura privilegiada/escrita staff (tenants, profiles, customers, store_settings, categories, category_attributes, products, product_variants, product_attribute_values, product_images, product_price_history, delivery_cities) ganham `and tenant_id = current_tenant_id()`; corrige a RPC `set_category_ativo_cascade` (mesmo gap). Ver decisão #21 | ✅ Aplicada em 31/07/2026 |
| 014 | `rls_select_anon_authenticated_split` — corrige o SEGUNDO vazamento encontrado ao testar a `013` com o tenant sintético: as policies `*_select_public` valiam pra `anon` e `authenticated` com a mesma condição, e a branch pública (`ativo = true` / `using(true)`, sem tenant) vazava leitura cross-tenant pra qualquer sessão autenticada (staff e cliente logado). Separa em policy `_select_anon` (mantém aberta, pensada pra vitrine) e `_select_authenticated` (sempre `tenant_id = current_tenant_id()`) nas 8 tabelas afetadas: categories, category_attributes, products, product_variants, delivery_cities, store_settings, product_attribute_values, product_images. Ver decisão #21 | ✅ **Aplicada e validada** em 31/07/2026 — preenche o número que tinha ficado vago na renumeração abaixo |
| 015 | `products`/`product_variants` ganham `DEFAULT current_tenant_id()` | ✅ **Aplicada e validada** em 31/07/2026. **Renumerada de `013` para `015` em 31/07/2026** — ver nota de rastreabilidade abaixo. |
| 016 | Código do Produto: `categories.prefixo_codigo`, `products.codigo`/`codigo_visivel`, `category_code_sequences`, RPCs `gerar_codigo_produto` e `criar_produto_com_variacoes` | ✅ **Aplicada e validada** em 31/07/2026 (corrigida antes da aplicação: `products_com_status` trocou `CREATE OR REPLACE VIEW` por `DROP`+`CREATE`, ver `docs/MIGRATIONS.md`). **Renumerada de `014` para `016` em 31/07/2026**; policy de `category_code_sequences` ajustada para já nascer com o filtro de tenant embutido (sem precisar de migration de correção posterior). Ver nota de rastreabilidade abaixo. |
| 017 | Edição atômica de produto+variações: RPC `atualizar_produto_com_variacoes` (simétrica à `criar_produto_com_variacoes`, `codigo` nunca no payload, variações removidas viram soft delete) + SKU automático das variações (`abreviar_rotulo`, `gerar_sku_variacao`) + revisão de `criar_produto_com_variacoes` (016, já aplicada) via `create or replace` para ganhar o mesmo SKU automático — extensão de comportamento, não descarte. Ver `REGRAS_DE_NEGOCIO.md` §4.4 | ✅ **Aplicada e validada com Chromium real** em 01/08/2026 — testada via edição de produto (variação nova + variação removida com soft delete confirmado, código imutável confirmado) |
| 018 | **Fecha o TERCEIRO vazamento cross-tenant** (decisão #21), desta vez numa view, não numa policy: `products_com_status` foi criada sem `security_invoker = true`, ignorando o RLS e vazando produtos entre tenants na listagem `/painel/produtos` (a edição, que lê a tabela direto, isolava certo). Correção: `alter view ... set (security_invoker = true)`. Única view do projeto — nenhuma outra a corrigir. Ver §2 e `docs/MIGRATIONS.md` | ✅ **Aplicada e validada** em 01/08/2026 — `reloptions` confirmado `security_invoker=true`; reteste de isolamento com o canário confirmou `de_outro_tenant=0` |

**Nota de rastreabilidade (regra de §0)**: as migrations descritas como `013`/`014` nas sessões de 30/07/2026 (Código do Produto) foram **renumeradas para `015`/`016`** em 31/07/2026, sem perda de conteúdo — só o número do arquivo mudou (via `git mv`) e a policy de `category_code_sequences` ganhou o filtro de tenant diretamente (em vez de precisar de uma correção posterior). O motivo: decidiu-se tratar o isolamento total por tenant (decisão #21) *antes* de aplicar qualquer coisa relacionada a Produtos, e esse isolamento precisava do número `013` por ser cronologicamente anterior. Nenhuma decisão de produto foi descartada — só a numeração dos arquivos `.sql` ainda não aplicados. **Atualização de 31/07/2026**: o número `014`, que tinha ficado vago nessa renumeração, foi preenchido pela migration `014_rls_select_anon_authenticated_split.sql` (o segundo vazamento encontrado no teste de isolamento) — ver `docs/MIGRATIONS.md` pra confirmação de que isso não é um arquivo "reaproveitado" por engano, é uma migration nova e distinta que só coincide de usar o número que estava livre.

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
│   │   └── painel/       Route Handlers de CRUD (cidades, categorias + caracteristicas/reorder,
│   │                     produtos + [id] + codigo-sugerido — GET/POST/PATCH)
│   ├── auth/callback/    callback de confirmacao de e-mail / magic link
│   ├── painel/           layout protegido (so staff) + cidades/ + categorias/ + produtos/ (novo/, [id]/)
│   └── sair/             POST — logout
├── components/
│   ├── painel/
│   │   ├── crud/         StatusFilterTabs, SearchInput, StatusBadge, ConfirmDialog, FormDialog
│   │   ├── cidades/
│   │   ├── categorias/   arvore, form (com prefixo_codigo), Sheet+lista+form de Caracteristicas (drag-and-drop)
│   │   └── produtos/     produtos-view/table, produto-form (3 blocos: dados-basicos,
│   │                     codigo-section, variacoes-section)
│   └── ui/                20 componentes shadcn (preset Base UI) + combobox.tsx, sheet.tsx (custom/reaproveitado)
├── hooks/                 use-cidades, use-categorias, use-caracteristicas, use-delivery-cities,
│                          use-produtos, use-query-param-state
├── lib/
│   ├── supabase/          client.ts (browser), server.ts (SSR/Route Handlers), admin.ts (service_role)
│   ├── auth.ts             getStaffProfile()
│   ├── category-tree.ts   buildTree, getDescendantIds (anti-ciclo), computeVisibleIds, getPath, slugify
│   ├── produto-codigo.ts  derivarPrefixo, formatarCodigo
│   └── tenant.ts           resolucao de tenant (hoje constante)
├── types/database.ts       tipos gerados/ajustados a mao do schema Supabase
└── proxy.ts                somente leitura: redireciona /entrar <-> /painel

supabase/
├── migrations/             001 a 018, ver secao 6 (todas aplicadas e validadas)
└── tests/                  isolamento_test.sql (script de verificacao RLS, nao e migration)

docs/                        VISAO_CAUA.md (visao original) + este documento + REGRAS_DE_NEGOCIO.md + MIGRATIONS.md
```

### Débito técnico conhecido

- ~~`src/app/(auth)/entrar/entrar-action.ts` — Server Action de login de uma iteração anterior do fluxo de auth, não usada.~~ **Removida em 29/07/2026** (confirmado sem nenhuma referência no código antes de apagar; build seguiu passando).

---

*Este documento substitui o `docs/VISAO_CAUA.md` como referência de estado atual — o `VISAO_CAUA.md` permanece como registro histórico da concepção inicial do projeto (F1), não é mais atualizado.*
