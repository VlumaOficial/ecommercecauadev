# REGRAS DE NEGÓCIO — E-commerce Criatório Capuã

**Última atualização:** 30/07/2026
**Propósito:** descrever o comportamento do sistema em linguagem clara, sem jargão técnico onde possível. Este documento é a base do futuro manual do usuário/lojista.

---

## 0. Regra de processo (definition of done)

> **Este documento e `docs/ESCOPO_PROJETO.md` DEVEM ser atualizados a cada nova decisão de negócio ou feature entregue, ANTES de considerar a tarefa concluída.**

Cada regra abaixo indica seu status: **✅ Em vigor** (implementada e funcionando), **📐 Decidida** (definida, aguardando implementação) ou **⏳ A definir** (ainda não decidida).

---

## 1. Acesso e perfis

**✅ Em vigor**

- **Cliente final**: acessa a loja pública, monta pedido. Cadastro pode exigir e-mail/senha (configurável — ver §2).
- **Equipe (staff)**: dois papéis —
  - **Admin**: acesso total ao painel administrativo.
  - **Operador**: acesso aos cadastros do painel; a permissão de **aceitar pedidos** é concedida individualmente (`pode_aceitar_pedido`), não é automática por ser operador.
- Um usuário nunca é cliente e staff ao mesmo tempo — o cadastro (via metadata no signup) decide se a conta vira uma linha em `profiles` (staff) ou `customers` (cliente).
- Só staff acessa `/painel`; cliente não-staff é redirecionado para a loja.

---

## 2. Fechamento da loja — dois níveis independentes

**📐 Decidida e modelada, migration `007` aplicada no banco** — **UI de configuração ainda não existe.**

A loja tem dois interruptores independentes, não um só:

| Nível | Campo | Efeito quando desligado |
|---|---|---|
| **Nível 1 — Loja** | `loja_aberta` | A loja inteira fica inacessível. O cliente vê apenas a mensagem configurada (`mensagem_loja_fechada`). Nem o catálogo aparece. |
| **Nível 2 — Pedidos** | `pedidos_abertos` | O catálogo (vitrine) continua visível e navegável, mas o cliente **não consegue finalizar pedido** (checkout bloqueado). Mostra `mensagem_pedidos_fechados`. |

Regra de combinação:

- `loja_aberta = false` → cliente só vê a mensagem de loja fechada (Nível 2 é irrelevante, nem chega a ser avaliado).
- `loja_aberta = true` **e** `pedidos_abertos = false` → catálogo visível, botão de finalizar pedido bloqueado, mensagem de pedidos fechados exibida.
- `loja_aberta = true` **e** `pedidos_abertos = true` → loja funcionando normalmente.

**Por quê dois níveis:** permite ao lojista deixar a vitrine aberta pra "esquentar" o próximo ciclo (cliente vê o catálogo, decide o que quer) sem ainda liberar o checkout — por exemplo, enquanto o estoque do ciclo ainda está sendo conferido.

---

## 3. Soft delete e visibilidade — regra universal do painel

**✅ Em vigor** (Cidades, Categorias) — **é o padrão obrigatório para toda entidade nova gerida pelo painel.**

- **Nenhum registro é excluído de verdade.** Toda entidade administrável (cidade, categoria, e futuramente produto/variação) tem um campo `ativo`. "Excluir" no painel significa **inativar** (`ativo = false`), nunca `DELETE`.
- Toda listagem do painel tem um filtro de três posições: **Ativos** (padrão), **Inativos**, **Todos**.
- Registro inativo aparece com badge cinza "Inativo"; ativo aparece com badge verde "Ativo".
- **Confirmação é pedida só ao inativar** (ação com efeito colateral, reversível mas não trivial de perceber). Reativar é instantâneo — **exceto** quando reativar também tem efeito em cascata (ver §3.1), caso em que também pede confirmação.
- Cliente final só enxerga registros **ativos** (a menos que a regra de visibilidade da entidade diga o contrário — ver `RLS` no `ESCOPO_PROJETO.md`).

### 3.1 Cascata de inativação/reativação em Categorias

**✅ Em vigor** (migration `011`, RPC `set_category_ativo_cascade`) — testada com Chromium real contra o banco: filha já inativa por decisão própria não é tocada em nenhum dos dois sentidos; filha ativa é cascateada ao inativar o pai e restaurada corretamente ao reativá-lo.

Categoria é uma árvore (§4.2), então inativar uma categoria com filhas exige uma regra própria:

- **Ao inativar** uma categoria que tem subcategorias (descendentes, qualquer profundidade) **ativas**: a inativação é **em cascata** — toda a subárvore ativa também é inativada. O sistema **registra quais foram arrastadas pela cascata** (diferente de quem já estava inativa por decisão própria antes). Aviso mostrado antes de confirmar: *"Ao inativar 'X', as N subcategorias ativas abaixo também serão inativadas."* Essa é exatamente a situação que o log de auditoria (§6) existe para explicar depois: uma ação sobre 1 categoria que muda o status de N — o `audit_log` guarda que foi uma cascata disparada a partir de "X", não N decisões independentes.
- **Ao reativar**: só voltam **as descendentes que foram inativadas por causa desta cascata** — quem já estava inativa por decisão própria (antes ou independentemente da cascata) **permanece intacta**, não é reativada de carona. Aviso: *"Ao reativar 'X', as N subcategorias inativadas junto com ela voltarão."*
- Caso não haja subcategorias ativas (pra inativar) ou nenhuma marcada como cascateada (pra reativar), o comportamento é o simples de sempre (sem aviso extra, sem confirmação extra na reativação).

### 3.2 Visibilidade de categoria inativa na vitrine

**📐 Registrada como requisito — vitrine ainda não existe, nada a implementar hoje.**

Quando a vitrine pública for construída: uma categoria inativa deve esconder da navegação **toda a sua subárvore**, mesmo que alguma subcategoria individualmente esteja marcada como ativa (ela só fica alcançável de novo quando o ramo inteiro acima dela voltar a ficar ativo). Isso é responsabilidade da query da vitrine, não do CRUD administrativo em si — no painel, cada categoria continua mostrando seu próprio status independente (§3.1).

---

## 4. Catálogo

### 4.1 Vocabulário da interface

**✅ Em vigor** (aplicado no CRUD de Categorias; vale para todo o resto do catálogo)

Nas telas voltadas ao lojista, os termos técnicos internos **não aparecem**. Vocabulário obrigatório na interface:

| Nunca mostrar ao lojista | Mostrar sempre |
|---|---|
| "Atributos" | **"Características"** |
| "SKU" / "Variants" | **"Variações"** |

Decisão baseada em pesquisa de mercado (Nuvemshop, Shopify) — é assim que lojistas não-técnicos reconhecem esses conceitos. Os nomes técnicos (`category_attributes`, `product_variants`, "attribute") continuam existindo normalmente no código e no banco; a regra é só sobre o que aparece na tela.

### 4.2 Categorias em árvore

**✅ Em vigor**

- Categorias formam uma árvore de profundidade livre (categoria pode ter categoria-pai; pai pode ter pai; sem limite de níveis).
- Categoria sem pai = categoria raiz.
- Uma categoria **não pode** ser definida como pai dela mesma nem de nenhuma de suas próprias subcategorias (isso criaria um loop). O sistema impede essa escolha na interface e recusa também no servidor caso, por algum motivo, chegue uma tentativa assim.
- Slug (identificador usado na URL) é gerado automaticamente a partir do nome, e pode ser editado manualmente. É único dentro da loja (não pode repetir, mesmo em ramos diferentes da árvore).

### 4.3 Características por categoria

**✅ Em vigor** (`/painel/categorias`, botão "Características" em cada categoria) — testado com Chromium real: criar, editar, inativar/reativar e reordenar por arrastar, com persistência confirmada no banco.

Cada categoria pode ter uma lista configurável de **características** (ficha técnica): nome, tipo (texto, número, seleção, sim/não), opções (quando o tipo é seleção), se é obrigatória, se aparece como filtro na vitrine, e a ordem de exibição (arrastar para reordenar). Quem define essas características é o **próprio lojista**, pelo painel — não é uma lista fixa no código. Segue o mesmo padrão de soft delete do resto do painel (inativar/reativar, nunca excluir de verdade).

**Sem herança entre categorias nesta fase**: cada categoria define as suas próprias características, mesmo que tenha uma categoria-pai. Um produto cadastrado numa categoria usa só a ficha daquela categoria específica — não herda automaticamente as características de categorias acima na árvore. Essa porta fica aberta para o futuro (a árvore já existe via `parent_id`), mas não foi implementada agora.

### 4.4 Produtos e variações (SKU)

**📐 Modelado — sem interface ainda.**

- O **produto** é a entidade de vitrine: nome, descrição, categoria, fotos.
- Cada produto tem uma ou mais **variações** (SKU) — por exemplo, "Pequeno"/"Médio"/"Grande", ou "500g"/"1kg". Um produto simples (sem variação de verdade) ainda assim tem exatamente 1 variação, chamada "Padrão".
- **Preço, promoção, estoque e quantidade mínima de compra vivem na variação, não no produto.** Um produto com 3 tamanhos pode ter 3 preços e 3 saldos de estoque diferentes.

### 4.5 Status do produto — sempre calculado

**📐 Modelado — sem interface ainda.**

Nenhum desses status é um campo que alguém marca manualmente — são sempre calculados a partir dos dados reais no momento da consulta:

- **Esgotado**: soma do estoque de todas as variações ativas é zero.
- **Em promoção**: existe pelo menos uma variação ativa com preço promocional menor que o preço normal.
- **Novidade**: produto foi criado recentemente (janela de tempo a definir na UI).

---

## 5. Entrega

**✅ Em vigor (cadastro de cidades)** — regras de uso no pedido ainda não implementadas.

- Entrega acontece em **ponto de encontro fixo por cidade** (não é entrega em domicílio).
- Cada cidade de entrega tem: ponto de encontro, horário, observações — cadastrados pelo painel (`/painel/cidades`).
- Cliente escolhe sua cidade de entrega no cadastro.

---

## 6. Auditoria (rastreabilidade interna VLUMA)

**📐 Decidida — não implementada ainda.**

Toda ação de escrita no painel (criar, editar, inativar, reativar) fica registrada: quem fez, quando, o que mudou (dado antes e depois). Isso **não é uma tela que o lojista (admin do tenant) vê** — é uma ferramenta interna da VLUMA, pensada pro **Super Admin** (ver `ESCOPO_PROJETO.md`, decisão #15) conseguir reconstruir o histórico de qualquer loja quando precisar investigar algo — por exemplo, entender que uma leva de subcategorias ficou inativa porque foi arrastada pela cascata de inativação de uma categoria-pai (§3.1), e não por N ações manuais separadas.

Também é uma característica candidata a virar **diferencial pago** do SaaS no futuro (plano com histórico de auditoria estendido, por exemplo).

---

## 7. Documentos Legais e Aceite (LGPD)

**📐 Decidida — não implementada.** Sequenciada para **depois da vitrine (F4)**, na fase de preparação para produção (só fica urgente quando há coleta real de dados de clientes reais).

Obrigação legal (LGPD): a loja precisa comprovar que o cliente aceitou os termos antes de usar o serviço, não só exibi-los.

- **Aceite obrigatório no cadastro**: checkbox obrigatório (o cliente não consegue prosseguir sem marcar) com links para a Política de Privacidade e os Termos de Uso completos.
- **Registro do aceite para comprovação**: fica gravado quem aceitou, quando (timestamp), qual **versão** do documento foi aceita, e o IP de origem — é isso que sustenta a comprovação em caso de disputa ou auditoria.
- **Documentos versionados**: uma nova versão publicada pode exigir que o cliente aceite de novo (o aceite de uma versão antiga não vale pra versão nova).
- **Por tenant**: cada loja do SaaS tem seus **próprios** documentos — não é um texto único genérico compartilhado entre todos os clientes da VLUMA (decisão pensada pro modelo multi-tenant).
- **Páginas públicas**: cada documento tem sua própria página, acessível sem login, linkada no rodapé do site.
- **Textos-base**: um texto inicial de Política de Privacidade e Termos de Uso (adequado a e-commerce brasileiro/LGPD) é gerado como ponto de partida — **isso não é aconselhamento jurídico e precisa de revisão por advogado antes de qualquer loja real entrar em produção.**

---

## 8. Pendente de definição (⏳)

As seções abaixo serão preenchidas conforme cada módulo for desenhado — mantidas aqui como lembrete do que falta decidir:

- **Carrinho e checkout**: regra de valor mínimo de pedido, quantidade mínima por variação, o que acontece se o estoque mudar entre adicionar ao carrinho e finalizar.
- **Reserva de estoque**: `store_settings.baixa_estoque_na_reserva` já existe no modelo (baixa no aceite vs. reserva na finalização, com expiração em minutos) — regra de negócio completa (o que acontece quando a reserva expira, notificação ao cliente) ainda não escrita.
- **Pedidos**: fluxo de aceite pelo staff, o que pode ser alterado pelo staff antes de aceitar, geração de PDF, envio por WhatsApp.
- **Pagamento**: fora do sistema no MVP — regra de como isso é registrado/conciliado ainda não definida.
- **Promoções por ciclo**: como um ciclo de vendas começa/termina e como isso se relaciona com `pedidos_abertos`.

---

*Ver `docs/ESCOPO_PROJETO.md` para a visão técnica (stack, modelo de dados, arquitetura) por trás destas regras.*

*Entregável planejado: ao final do desenvolvimento, este documento é a base para gerar o **manual formal do usuário/lojista** — por isso a linguagem aqui evita jargão técnico desde o início.*
