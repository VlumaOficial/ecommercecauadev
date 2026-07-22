# VISÃO — E-commerce Criatório Capuã

**Cliente:** Criatório Capuã (peixes ornamentais e animais exóticos)
**Responsável pelo negócio:** Cauã
**Desenvolvimento:** VLUMA Tecnologia
**Data de início:** 22/07/2026
**Versão do documento:** 1.0

---

## 1. Contexto e Problema

O Criatório Capuã comercializa peixes ornamentais e animais exóticos em geral. O processo atual funciona assim:

1. Uma tabela de preços é divulgada mensalmente
2. A divulgação acontece em um grupo de WhatsApp
3. O cliente escolhe os itens e envia a lista para o Cauã
4. O Cauã confere estoque manualmente
5. O pedido é gerado em uma planilha Excel
6. Vendas e entregas acontecem em um período específico do mês

**Dores identificadas:** conferência manual de estoque, geração de pedido em planilha, ausência de histórico estruturado, dependência total do Cauã para cada pedido.

**Objetivo:** criar um e-commerce que automatize a montagem do pedido pelo próprio cliente e reduza o trabalho operacional do Cauã.

---

## 2. Decisões de Produto

| # | Tema | Decisão |
|---|---|---|
| 1 | Quem faz o pedido | O cliente final acessa a loja e monta o carrinho |
| 2 | Arquitetura de tenancy | Single-tenant no MVP, código preparado para multi-tenant futuro |
| 3 | Cadastro obrigatório | Configurável no painel (exigir cadastro ou permitir convidado) |
| 4 | Preços | Variam por ciclo; existem promoções |
| 5 | Quantidade mínima | Por produto, configurável |
| 6 | Abertura da loja | Fechamento total (cliente sem acesso) + fechamentos parciais a refinar |
| 7 | Pagamento | Fora do sistema no MVP; meios de pagamento em evolução futura |
| 8 | Entrega | Ponto de encontro fixo por cidade (~5 cidades), horário padrão por cidade |
| 9 | Perfis de acesso | Admin (total) e Operador (cadastros + permissão granular para aceitar pedidos) |
| 10 | Cadastro de produto | Campos dinâmicos configuráveis por categoria |
| 11 | Controle de estoque | Definido por produto: quantitativo ou disponível/esgotado |
| 12 | Baixa de estoque | Configurável: reserva na finalização ou baixa no aceite |

---

## 3. Fluxo do Pedido (MVP)

```
Cliente monta carrinho
  ↓  (valida valor mínimo de compra e quantidade mínima por produto)
Finaliza pedido → status PENDENTE
  ↓
Cauã valida no painel (estoque real, eventuais acréscimos)
  ↓
ACEITE do pedido
  ↓
Sistema gera PDF do pedido automaticamente
  ↓
Envio ao cliente via WhatsApp (Evolution API)
  ↓
Pagamento e entrega fora do sistema (ponto de encontro na cidade)
```

---

## 4. Stack Tecnológica

### Escolhida

```
Next.js 16.2.11 (App Router) + TypeScript 5
React 19.2.4
Tailwind CSS v4 (@tailwindcss/postcss)
Shadcn/ui 4.14 — preset Nova (Base UI + Lucide + Geist)
TanStack Query v5
React Hook Form + Zod + @hookform/resolvers
Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron)
Evolution API + N8N (via Route Handler)
Deploy: Vercel
```

### Justificativa das escolhas-chave

**Next.js em vez de Vite/SPA.** Decisão tomada considerando a evolução para multi-tenant. Motivos:

- **Open Graph dinâmico** — quando o Cauã compartilha o link de um produto no grupo do WhatsApp, o card exibe foto, nome e preço daquele item. Isso exige renderização no servidor (`generateMetadata`); numa SPA o crawler do WhatsApp recebe HTML vazio.
- **SEO por tenant** — no futuro SaaS, cada criatório terá páginas indexáveis, sitemap dinâmico, JSON-LD de produto e domínio próprio. Vira argumento comercial ("sua loja no Google").
- **Custo de migração** — sair de SPA para SSR com clientes em produção seria muito mais caro que nascer certo.

**Base UI em vez de Radix.** O Shadcn adotou Base UI como padrão; Radix está em manutenção. Melhor suporte a React 19.

**Estoque atômico no banco, não em código de aplicação.** Diferente do padrão adotado no Almox (estoque interno), aqui o estoque é público e concorrente. No dia da abertura do ciclo, dois clientes clicando "finalizar" no mesmo item é cenário garantido. Baixa e reserva devem ocorrer dentro de transação Postgres (`SELECT ... FOR UPDATE` em função `SECURITY DEFINER`).

**Componente `Form` do Shadcn ausente.** O preset Base UI não entrega `form.tsx` (é acoplado ao Radix). Formulários serão feitos com `react-hook-form` + `@hookform/resolvers/zod` diretamente sobre `Input`/`Label`/`Select`.

### Descartado

- **Redux/Zustand** — TanStack Query cobre estado de servidor; carrinho via Context + localStorage.
- **Tailwind v3** — o `create-next-app` já entrega v4 e o Shadcn tem suporte oficial. Projeto novo, sem dívida a arrastar.

---

## 5. Regras de Portabilidade (multi-tenant futuro)

Quatro disciplinas que tornam a evolução para SaaS barata:

1. **Zero lógica de negócio no frontend.** Tudo em RPC Postgres e Edge Functions.
2. **`tenant_id` presente desde a primeira tabela**, com valor fixo no MVP.
3. **Resolução de tenant isolada** em `src/lib/tenant.ts`. Hoje devolve constante; amanhã lê subdomínio.
4. **TanStack Query como única porta de dados.** Nenhum componente chama Supabase diretamente.

---

## 6. Ambientes

| Item | DEV (Homologação) | PRD (Produção) |
|---|---|---|
| Repositório | `VlumaOficial/ecommercecauadev` | `VlumaOficial/ecommercecaua` |
| Supabase ref | `embgxkrfwtbqfkwmquvo` | `oeovdvmszxucvvmrprsr` |
| Vercel | `ecommercecauadev.vercel.app` | a configurar |
| Status | ✅ operacional | ⏳ pendente |

**Pasta local:** `/home/sdorea/vluma/caua` (filesystem nativo WSL)

> **Lição registrada:** a instalação inicial em `/mnt/c/vluma/caua` levou **10 horas** para 356 pacotes, por causa da camada de tradução 9P entre Linux e Windows. A mesma instalação em `~/vluma/caua` levou **23 segundos**. Todo projeto Node no WSL deve viver no filesystem nativo. Acesso pelo Windows via `\\wsl$\Ubuntu\home\sdorea\vluma\caua`.

### Variáveis de ambiente

```
NEXT_PUBLIC_APP_ENV
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      (servidor apenas — ignora RLS)
NEXT_PUBLIC_TENANT_SLUG
EVOLUTION_API_URL
EVOLUTION_API_KEY
EVOLUTION_INSTANCE
N8N_WEBHOOK_URL
```

Configuradas na Vercel (build/runtime) e em `.env.local` (comandos CLI: migrations, geração de tipos). O `.env.local` é ignorado pelo Git; o `.env.example` é versionado como referência.

---

## 7. Estrutura do Projeto

```
caua/
├── .github/workflows/
│   └── keepalive.yml
├── docs/
│   └── VISAO_CAUA.md
├── src/
│   ├── app/
│   │   ├── (loja)/
│   │   ├── (admin)/
│   │   ├── api/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/          (19 componentes Shadcn)
│   │   ├── layout/
│   │   └── providers.tsx
│   ├── hooks/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts    (browser)
│   │   │   ├── server.ts    (Server Components)
│   │   │   └── admin.ts     (service_role — nunca no browser)
│   │   ├── validations/
│   │   ├── tenant.ts
│   │   └── utils.ts
│   ├── types/
│   └── proxy.ts             (renovação de sessão Supabase)
└── supabase/migrations/
    └── 001_keepalive.sql
```

> **Nota Next 16:** a convenção `middleware.ts` foi renomeada para `proxy.ts`, com `export default` em vez de `export function middleware`.

---

## 8. Keep-Alive (padrão VLUMA v2.1)

Implementado desde o setup inicial, conforme padrão obrigatório para todos os ambientes de todos os projetos.

- **Tabela:** `keepalive_ping` — singleton (`id smallint default 1` com constraint), colunas `ambiente` e `last_ping`
- **RLS:** habilitado, política `SELECT` para role `anon`
- **Workflow:** GitHub Action, cron `0 */8 * * *` (a cada 8h) + `workflow_dispatch`
- **Secrets:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_TABLE`
- **Coluna `ambiente`:** contorna o mascaramento automático de secrets nos logs do GitHub, permitindo identificar qual ambiente respondeu

**Validação DEV:** HTTP 200, resposta `{"ambiente":"DEV","last_ping":"..."}`

---

## 9. Fluxo de Trabalho

```
Claude envia comando (um por vez)
  ↓
Sérgio executa no WSL e retorna a saída
  ↓
Commit + push → GitHub (DEV)
  ↓
Deploy automático Vercel
  ↓
Homologação na URL pública
  ↓
Promoção para PRD
```

**Regras:**
- Um comando por vez, aguardando retorno
- Sem execução de `npm run dev` (validação via `npm run build` e homologação na Vercel)
- Migrations versionadas em `supabase/migrations/`, aplicadas via SQL Editor
- Credenciais nunca em chat; `.env.local` fora do Git

---

## 10. Status — Fase 1 (Setup)

| Item | Status |
|---|---|
| Next.js 16 + TypeScript + Tailwind v4 | ✅ |
| Shadcn/ui + 19 componentes | ✅ |
| Dependências da stack | ✅ |
| Estrutura de pastas | ✅ |
| Variáveis de ambiente (local + Vercel) | ✅ |
| Clients Supabase (browser/server/admin) | ✅ |
| Proxy de renovação de sessão | ✅ |
| Módulo de resolução de tenant | ✅ |
| TanStack Query Provider + Toaster | ✅ |
| Metadata pt-BR | ✅ |
| Keep-alive (tabela + Action + secrets) | ✅ |
| Repositório DEV + push inicial | ✅ |
| Deploy Vercel DEV | ✅ |
| Documentação | ✅ |
| Ambiente PRD | ⏳ adiado até fim da F4 |

**Commit inicial:** `902977b` — 35 arquivos

---

## 11. Roadmap Preliminar

| Fase | Escopo | Status |
|---|---|---|
| **F1** | Setup do ambiente | ✅ |
| **F2** | Modelo de dados, RLS, campos dinâmicos, estoque atômico | ⏳ |
| **F3** | Autenticação e perfis (Admin/Operador/Cliente) | ⏳ |
| **F4** | Catálogo e UX da loja (grid, ficha, Open Graph) | ⏳ |
| **F5** | Carrinho e checkout (valor mínimo, qtd. mínima) | ⏳ |
| **F6** | Painel administrativo — pedidos e aceite | ⏳ |
| **F7** | Geração de PDF (Edge Function) | ⏳ |
| **F8** | Integração WhatsApp (Evolution API / N8N) | ⏳ |
| **F9** | Ciclos, promoções e abertura/fechamento da loja | ⏳ |
| **F10** | Cidades e pontos de entrega | ⏳ |
| **F11** | Relatórios | ⏳ |
| **F12** | Segurança (OWASP + isolamento multi-tenant) | ⏳ |
| **F13** | Manual do usuário | ⏳ |
| **F14** | Promoção para PRD | ⏳ |

---

## 12. Pendências e Pontos em Aberto

- **UX/identidade visual** — a definir antes da F2, para que decisões de banco (slug, ordem de exibição, campos de destaque) nasçam alinhadas à interface
- **Fechamentos parciais da loja** — regra a refinar
- **Prazo de expiração da reserva de estoque** — a definir
- **Rotação da service_role de DEV** — recomendada antes da entrada de dados reais
- **Vulnerabilidades npm** — 3 pendentes (1 moderate, 2 high); avaliar após estabilização das dependências
- **Regras de negócio detalhadas** — serão definidas módulo a módulo, conforme acordado

---

*Documento gerado em 22/07/2026 — VLUMA Tecnologia*
