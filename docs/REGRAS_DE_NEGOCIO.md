# REGRAS DE NEGÓCIO — E-commerce Criatório Capuã

**Última atualização:** 01/08/2026 (data original de criação do documento: 30/07/2026)
**Propósito:** descrever o comportamento do sistema em linguagem clara, sem jargão técnico onde possível. Este documento é a base do futuro manual do usuário/lojista.

---

## 0. Regra de processo (definition of done)

> **Este documento e `docs/ESCOPO_PROJETO.md` DEVEM ser atualizados a cada nova decisão de negócio ou feature entregue, ANTES de considerar a tarefa concluída.**

Cada regra abaixo indica seu status: **✅ Em vigor** (implementada e funcionando), **📐 Decidida** (definida, aguardando implementação) ou **⏳ A definir** (ainda não decidida).

### 0.1 Disparos de notificação em ambiente de teste (insert-only, 02/09/2026)

**✅ Em vigor.** Qualquer teste que possa **disparar uma notificação real** (e-mail ou WhatsApp — checkout, validar, ajustar, concluir, cancelar) só pode endereçar **destinatários reais controlados pelo PO**:

- **E-mail:** `sergiodorea1975@gmail.com`
- **WhatsApp:** `71991215016`

**Nunca** usar e-mail ou WhatsApp **fabricado** num cliente de teste. Um número/e-mail inventado pode pertencer a um terceiro real (spam a estranho) ou colidir com a própria linha da instância de envio (auto-envio). **Evidência concreta:** no teste do incremento 3 (`pedido_entregue`, pedido de teste **#43**, 02/09/2026), o cliente de teste foi criado com o WhatsApp fabricado `71991240000`; após o prefixo DDI (`canal-whatsapp.ts`, `55` + dígitos) virou `5571991240000`, que **coincidiu com o número WhatsApp conectado na instância Evolution** — a instância enviou "pedido entregue" **para si mesma**. Ver `ESCOPO_PROJETO.md` §0 (diagnóstico de segurança do #43) e §1 "Checklist de pré-produção" item 1 (identidade de remetente de teste × real do Criatório Capuã, GRUPO C).

Quando **não se quer** disparo num teste, deixar o campo **vazio**: `notificar-pedido.ts` só envia WhatsApp se `cliente.whatsapp` estiver preenchido (`if (cliente.whatsapp)`), e só envia e-mail se `cliente.email` estiver preenchido — campo vazio = canal pulado, sem erro.

**O teste end-to-end de recebimento real (todos os canais, todos os eventos) é conduzido pelo PO**, não pelo assistente — o assistente valida o fluxo de painel/checkout (status HTTP, transição de estado, ausência de regressão) e a não-quebra da resposta ao usuário; a confirmação de que a mensagem chega fica com o PO.

### 0.2 Cleanup de teste não-destrutivo (insert-only, 04/09/2026)

**✅ Em vigor.** Scripts/rotinas de teste **nunca** devem apagar dados via `DELETE`/`deleteUser` cascateante como forma de limpeza. O princípio do projeto é **desativar, não deletar** (soft delete universal, `REGRAS_DE_NEGOCIO.md` §3) — o cleanup de um teste segue a mesma lógica: usar dados descartáveis (registro isolado, sem vínculo com histórico real) ou desativação (`ativo = false`), **nunca** um `DELETE` que cascateie em `auth.users`/`customers`/`orders`.

**Motivo:** o risco não é o teste em si dar errado — é um script de cleanup apontando pro alvo errado (id/e-mail trocado, ambiente errado) ou rodando contra um registro que na verdade tem histórico real por trás; um `DELETE` com `on delete cascade` nessa situação levaria dado de verdade junto, sem chance de reverter.

**Evidência que motivou a regra:** no teste do Inc 2 da Fase 3 (módulo de Clientes, 04/09/2026), o cleanup do script de teste usou `admin.auth.admin.deleteUser()` — que cascateia (`on delete cascade`, `customers.auth_user_id`) e apaga a linha de `customers` por completo. Funcionou sem incidente no tenant de teste daquela vez, mas é exatamente o padrão que esta regra passa a proibir daqui pra frente — cleanup de teste deve preferir desativar o registro de teste (`ativo = false`) a apagá-lo.

---

## 1. Acesso e perfis

**✅ Em vigor**

- **Cliente final**: acessa a loja pública, monta pedido. Cadastro pode exigir e-mail/senha (configurável — ver §2).
- **Equipe (staff)**: dois papéis —
  - **Admin**: acesso total ao painel administrativo.
  - **Operador**: acesso aos cadastros do painel; a permissão de **aceitar pedidos** é concedida individualmente (`pode_aceitar_pedido`), não é automática por ser operador.
- Um usuário nunca é cliente e staff ao mesmo tempo — o cadastro (via metadata no signup) decide se a conta vira uma linha em `profiles` (staff) ou `customers` (cliente).
- Só staff acessa `/painel`; cliente não-staff é redirecionado para a loja.

### 1.1 Sessão de acesso e expiração — decisões (insert-only, 03/09/2026)

**✅ Em vigor.**

- **A sessão de quem está logado (cliente ou staff) é renovada automaticamente enquanto a pessoa usa o sistema.** Ficar mais de uma hora logado **não** desloga — e esse é o comportamento correto e desejado. Não existe "expiração automática da sessão por tempo" como cenário de uso real.
- **Item 50 — trava de login: FECHADO (03/09/2026).** O botão "Entrar" da vitrine ficava **inerte** (clicar não fazia nada) para quem tinha uma sessão presente no navegador — seja um membro da equipe navegando pela loja, seja o resíduo de uma sessão anterior. A causa raiz era o **cache de navegação do próprio navegador** guardando um redirecionamento antigo da tela de login — **não** era cookie corrompido nem o servidor (as três tentativas anteriores trataram a camada errada). Correção: (A) ir para a tela de login passou a ser sempre uma navegação de página inteira, que ignora esse cache; (B) um membro da equipe que abre a vitrine vê **"Ir para o painel"** no lugar de "Entrar". O rótulo "logout automático" usado durante a investigação era o nome do **sintoma**, não um evento de tempo. Detalhe técnico completo em `ESCOPO_PROJETO.md` §0 item 50.
- **Futuro (decisão de produto, baixa prioridade — não é bug):** avaliar uma **política de expiração de sessão da equipe (staff) por segurança** — por exemplo, encerrar a sessão após um período de inatividade e/ou ao fechar o navegador —, ponderando o risco de um computador compartilhado no balcão da loja ficar logado sem ninguém por perto. Registrado no roadmap (§8), a decidir; não implementar agora. **Não se aplica ao cliente** — para o cliente final, sessão longa é conveniência, não risco.

---

## 2. Fechamento da loja — dois níveis independentes

**📐 Decidida e modelada, migration `007` aplicada no banco.** **✅ Em vigor no lado da leitura desde 12/08/2026** — a Vitrine pública (`(loja)/**`, Fase 1 Etapa 2) já respeita os dois níveis: `loja_aberta=false` mostra só a mensagem, sem header/nav/catálogo nenhum; `pedidos_abertos=false` (com loja aberta) mostra uma faixa com `mensagem_pedidos_fechados` acima do catálogo, que continua navegável — não há botão de finalizar pedido ainda pra bloquear de verdade (Carrinho/Checkout é fase futura), então esse nível só afeta o aviso por enquanto. **UI de configuração pro lojista editar os dois campos ainda não existe** — a Etapa 4 do plano da Vitrine Fase 1 (`ESCOPO_PROJETO.md` §0 itens 28/29, concluída em 14/08/2026) ficou restrita a banner/selos/WhatsApp/identidade (o que os pedidos da etapa listaram); `loja_aberta`/`pedidos_abertos`/as duas mensagens de fechamento **continuam só editáveis por SQL direto**, sem tela — pendência real pra uma etapa futura (fora do escopo do que já foi pedido), não coberta por engano.

**✅ Pendência fechada em 25/08/2026** — item (4) da sequência pré-incremento 8 (`ESCOPO_PROJETO.md` §0), módulo de Configuração (`/painel/configuracoes`), traz a tela pro grupo "Status da loja": `loja_aberta`, `mensagem_loja_fechada`, `pedidos_abertos`, `mensagem_pedidos_fechados` agora são editáveis pelo lojista (admin), sem precisar de SQL direto. Detalhe completo (desenho, escopo, teste) em `ESCOPO_PROJETO.md` §0 item 49/50.

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

**📌 Decisão registrada com o PO em 15/08/2026 (`ESCOPO_PROJETO.md` §0 item 30, decisão #26)**: o bloqueio do Nível 2 acontece no momento em que o cliente tenta **adicionar um item ao carrinho**, não numa tela de checkout separada — é dentro do fluxo do Carrinho (Fase 2), não um módulo à parte. Antes disso, o cliente pode navegar, ver produtos, preços e disponibilidade normalmente; só a ação de adicionar ao carrinho é que dispara o aviso (`mensagem_pedidos_fechados`). Contexto de negócio que motivou o modelo: o Cauã vende/entrega num período determinado do mês (ciclo), não continuamente — os dois níveis cobrem esse padrão sem precisar de lógica de datas/calendário nenhuma no sistema (o lojista liga/desliga manualmente, não é uma janela calculada automaticamente).

---

## 3. Soft delete e visibilidade — regra universal do painel

**✅ Em vigor** (Cidades, Categorias) — **é o padrão obrigatório para toda entidade nova gerida pelo painel.**

- **Nenhum registro é excluído de verdade.** Toda entidade administrável (cidade, categoria, e futuramente produto/variação) tem um campo `ativo`. "Excluir" no painel significa **inativar** (`ativo = false`), nunca `DELETE`.
- Toda listagem do painel tem um filtro de três posições: **Ativos** (padrão), **Inativos**, **Todos**.
- Registro inativo aparece com badge cinza "Inativo"; ativo aparece com badge verde "Ativo".
- **Confirmação é pedida só ao inativar** (ação com efeito colateral, reversível mas não trivial de perceber). Reativar é instantâneo — **exceto** quando reativar também tem efeito em cascata (ver §3.1), caso em que também pede confirmação.
- Cliente final só enxerga registros **ativos** (a menos que a regra de visibilidade da entidade diga o contrário — ver `RLS` no `ESCOPO_PROJETO.md`).

### 3.2 Exceção ao soft delete universal: Imagens de produto

**📐 Decidida em 02/08/2026, ✅ implementada em 03/08/2026.** Imagens de produto/variação (Produtos Etapa 3) são a **única exceção** à regra de soft delete universal desta seção — remover uma imagem é uma **exclusão real** (`DELETE` de verdade, tanto do arquivo no Storage quanto da linha no banco), sem confirmação estilo "inativar/reativar".

**Por quê**: soft delete existe pra entidades que fazem sentido **reativar** depois (uma cidade, uma categoria, um produto podem voltar a ficar disponíveis). Uma foto removida não tem um fluxo de "reativar" que faça sentido pro lojista — ele não vai querer trazer de volta uma imagem específica que decidiu tirar. Manter linha + arquivo órfãos no Storage pra sempre só acumula custo de armazenamento sem nenhum benefício real. A remoção ainda pede confirmação (é uma ação destrutiva, igual a inativar), só não existe um estado "inativo" intermediário — é apagar de vez.
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

**📐 Modelado — sem interface ainda.** **✅ Etapa 1 implementada e testada com Chromium real em 01/08/2026** — cadastro e edição de produto com variações em `/painel/produtos` (ver `ESCOPO_PROJETO.md` §4, tabela "Concluídas").

- O **produto** é a entidade de vitrine: nome, descrição, categoria, fotos.
- Cada produto tem uma ou mais **variações** (SKU) — por exemplo, "Pequeno"/"Médio"/"Grande", ou "500g"/"1kg". Um produto simples (sem variação de verdade) ainda assim tem exatamente 1 variação, chamada "Padrão".
- **Preço, promoção, estoque e quantidade mínima de compra vivem na variação, não no produto.** Um produto com 3 tamanhos pode ter 3 preços e 3 saldos de estoque diferentes.

**Formato do SKU automático (📐 decidido em 31/07/2026, ✅ implementado e testado em 01/08/2026):** quando o lojista não digita um SKU manual pra uma variação, o sistema gera um automaticamente: `[código do produto]-[abreviação do rótulo da variação]`. Exemplo original de decisão: produto com código `CIC-0042` → variação "Pequeno" vira `CIC-0042-PQ`, "Médio" vira `CIC-0042-MD`, "Padrão" vira `CIC-0042-PAD`. A abreviação usa até ~4 letras/números do rótulo (sem acento, maiúsculo); se duas variações do mesmo produto gerariam a mesma abreviação, a segunda ganha um número no final pra não colidir. Como o código do produto só é definido no momento de salvar (ver §4.6), o SKU automático também só é calculado nesse momento — o formulário mostra "SKU: automático" como indicação até lá, e o valor final aparece depois de salvar, sempre editável se o lojista quiser trocar.

**Nota de implementação (01/08/2026):** a abreviação implementada é um corte simples dos primeiros 4 caracteres alfanuméricos (sem tentar preservar só consoantes) — testado ao vivo, "Padrão" gerou `PADR` (não `PAD` como no exemplo ilustrativo original) e "Grande" gerou `GRAN`. Mantido assim por ser determinístico e simples de auditar; se o formato "estilo apelido" (`PQ`, `MD`, `PAD`) for realmente desejado, precisa de uma regra explícita de abreviação (ex.: remover vogais) a ser decidida — não implementado.

**Revisão da abreviação, 📐 decidida e ✅ implementada em 07/08/2026 (migration `027`):** o corte cru dos 4 primeiros caracteres causava colisão desnecessária entre rótulos parecidos (ex.: "Oscar Albino" e "Oscar" sozinho, os dois derivando `OSCA`, resolvido só pelo sufixo numérico). A abreviação passou a seguir a **mesma regra de divisão por palavras** já usada no prefixo de categoria/código de produto (decisão #24): 1 palavra → 3 primeiras letras; 2 palavras → 2 letras de cada; 3+ palavras → 2+1+1... até 4 caracteres. "Oscar Albino" (2 palavras) → `OSAL`, "Oscar" sozinho (1 palavra) → `OSC` — sem colidir. SKUs já existentes (gerados antes dessa mudança) **não são recalculados** — a nova regra vale só pra variações novas dali pra frente.

**Fotos por variação (📐 decidida e ✅ implementada em 03/08/2026):** além das fotos gerais do produto (galeria principal, até 10 imagens — ver `ESCOPO_PROJETO.md` §4), cada variação pode opcionalmente ter suas próprias fotos (até 5), pensado para o caso de tamanhos/cores visualmente diferentes entre si dentro do mesmo produto. É **opcional**: uma variação sem fotos próprias simplesmente usa as fotos gerais do produto — o lojista só precisa fotografar a variação separadamente quando isso realmente ajudar o cliente a diferenciar (ex.: "Pequeno" e "Grande" de um peixe que muda de cor com a idade). No painel, o uploader de cada variação fica **recolhido por padrão** dentro do formulário de edição, para não sobrecarregar a tela de quem só usa a galeria geral. Segue a mesma regra de exclusão real (não soft delete) já registrada em §3.2.

**Busca da listagem inclui SKU e rótulo de variação (📐 decidida e ✅ implementada em 05/08/2026):** na tela `/painel/produtos`, o campo de busca não procura mais só por nome/código do produto — também encontra o produto quando o texto digitado bate com o **SKU** ou o **rótulo** de qualquer uma das suas variações (ativa ou inativa). Útil pro lojista que só lembra do SKU de uma variação específica, não do nome/código do produto inteiro.

**A listagem mostra QUAL variação bateu, não só que o produto bateu (📐 decidida e ✅ implementada em 08/08/2026).** Antes, uma busca por SKU trazia o produto na lista sem dizer nada sobre qual variação era — o lojista precisava abrir o produto pra descobrir. Agora, quando o motivo do produto aparecer na busca foi uma variação (SKU ou rótulo, não o nome/código do produto em si), a listagem mostra uma faixa logo abaixo do produto com o nome da variação e o SKU, com o trecho digitado destacado. Sem abrir nada.

**Filtro de categoria em árvore navegável (📐 decidida e ✅ implementada em 09/08/2026).** A lista suspensa de categorias (uma linha por categoria, mostrando o caminho completo tipo "Peixes > Ciclídeos") virou um painel em árvore — expande/recolhe por categoria, com um contador de quantos produtos cada uma tem (considerando o filtro Ativos/Inativos/Todos já selecionado na tela) e um campo pra filtrar as categorias digitando o nome. Pensado pra quando a loja tiver muitas categorias em vários níveis — folhear uma árvore fica mais fácil que escanear uma lista longa achatada.

**Revisão de 10/08/2026, ✅ implementada no mesmo dia — o painel em árvore acima não escala além de dezenas de categorias, foi substituído.** Com centenas de categorias, mesmo uma árvore recolhida ainda é comprida demais pra rolar. Princípio novo: o lojista nunca vê todas as categorias de uma vez. Três formas de achar a categoria, todas no mesmo filtro: **(1) busca** — digitar encontra a categoria por qualquer parte do caminho, não só pelo nome dela mesma (por exemplo, digitar o nome de uma categoria "avó" encontra também os "netos" dela) — resolve tanto lembrar só pelo ramo quanto categorias com o mesmo nome em ramos diferentes; **(2) navegar nível por nível** — abre mostrando só as categorias principais, clicar numa que tem subcategorias mostra só as dela (nunca a árvore inteira ao mesmo tempo), com um caminho no topo pra voltar; **(3) recentes** — as últimas categorias usadas aparecem primeiro, sem precisar digitar nem navegar (guardado só neste computador/navegador — se o lojista usar outro computador ou outro funcionário usar o mesmo login, os recentes de cada um não aparecem pro outro; pode virar compartilhado entre a equipe no futuro se for necessário). Categoria escolhida vira uma etiqueta com "×" pra remover.

**Modo de estoque: só "quantitativo" daqui pra frente (📐 decidido e ✅ implementado em 06/08/2026, revisão de decisão anterior).** O modelo de dados de `product_variants` sempre teve dois modos — `quantitativo` (controla saldo por número, o padrão) e `disponibilidade` (só "disponível"/"indisponível", sem controlar quantidade) — mas na prática o negócio sempre trabalha com controle de quantidade. O modo `disponibilidade` causava um bug real: o lojista preenchia "Estoque inicial" numa variação nesse modo e o valor era descartado silenciosamente ao salvar (esse modo nunca gravou saldo, de propósito, mas o formulário não avisava nada). Em vez de só avisar melhor, a decisão foi remover o seletor de modo de estoque da tela por completo — toda variação nova nasce `quantitativo`, sem opção de escolher outra coisa. O enum/coluna `modo_estoque` continuam existindo no banco (sem migration destrutiva); variações que já estavam em `disponibilidade` antes dessa mudança mantêm o valor como está, sem conversão automática forçada.

**Dois mínimos distintos por variação (📐 decidido e ✅ implementado em 07/08/2026, migration `027`).** O campo único "Quantidade mínima" (§4.4, primeiro parágrafo desta seção) era ambíguo — servia tanto de nível de alerta de reposição (módulo de Estoque, "abaixo do mínimo") quanto seria, futuramente, a quantidade mínima que o cliente precisa comprar no checkout — sem nenhuma distinção entre os dois. Separado em dois campos, claramente rotulados no formulário:
- **Mínimo de estoque** (`quantidade_minima_estoque`, renomeada da coluna antiga — preserva o valor de toda variação já existente): nível de alerta de reposição, é o que o módulo de Estoque usa pra marcar uma variação como "abaixo do mínimo".
- **Mínimo de venda** (`quantidade_minima_venda`, nova, default 1): quantidade mínima de compra do cliente — regra de **checkout futuro**, ainda sem efeito nenhum na loja (não existe carrinho/checkout implementado ainda).

**Cadastro fica na tela depois de salvar (📐 decidido e ✅ implementado em 08/08/2026).** Antes, salvar um produto novo fechava a tela e voltava pra listagem — o lojista precisava procurar o produto de novo e reabrir só pra adicionar as fotos (que só ficam disponíveis depois do produto existir). Agora: ao criar um produto, a tela **não fecha** — vira automaticamente a tela de edição do mesmo produto (a seção de imagens destrava ali mesmo, sem precisar sair). Saída da tela passa a ser sempre uma escolha explícita do lojista: botão "Voltar para produtos", que pergunta antes de sair só se houver alguma alteração ainda não salva. O botão de salvar fica desabilitado enquanto nada foi alterado no formulário (evita clique em vazio) e reativa assim que o lojista mexe em qualquer campo — vale tanto pra criação (depois do primeiro save) quanto pra edição de um produto já existente. O botão "Voltar para produtos" aparece tanto no topo quanto numa barra fixa no rodapé (a mesma onde já fica o botão de salvar) — em produto com várias variações a tela fica comprida, e sem isso o lojista ficava preso lá embaixo sem jeito de sair sem rolar de volta pro topo.

### 4.5 Status do produto — sempre calculado

**📐 Modelado — sem interface ainda.** **✅ Em uso desde 01/08/2026** na listagem `/painel/produtos` (badges "Esgotado"/"Promoção" via `products_com_status`, confirmados com Chromium real).

Nenhum desses status é um campo que alguém marca manualmente — são sempre calculados a partir dos dados reais no momento da consulta:

- **Esgotado**: soma do estoque de todas as variações ativas é zero.
- **Em promoção**: existe pelo menos uma variação ativa com preço promocional menor que o preço normal.
- **Novidade**: produto foi criado recentemente (janela de tempo a definir na UI).

### 4.6 Código do Produto (identificação/referência)

**📐 Decidida — não implementada.** **✅ Implementada e testada com Chromium real em 01/08/2026** — prefixo por categoria, geração automática com prévia, código manual, imutabilidade após criação, todos confirmados ao vivo em `/painel/produtos`.

Além do SKU (código da variação, usado para controle de estoque — ver §4.4), cada produto tem um **Código** próprio: serve para identificação, referência e busca — inclusive pensado para lojistas que estão migrando de outro sistema e já têm uma codificação própria de produtos.

Diferença entre Código e SKU:

| | Código | SKU |
|---|---|---|
| Nível | Produto | Variação |
| Para quê | Identificação, referência, busca | Controle de estoque |
| Visibilidade | Configurável (pode aparecer na vitrine) | Interno, discreto |
| Geração | Automático **ou** manual (lojista escolhe) | Automático, mas editável |
| Muda? | Nunca, depois de criado | Pode ser ajustado |

Regras do Código:

- **Prefixo vem da categoria do produto**, nunca da loja como um todo. Cada categoria tem seu próprio prefixo (cadastrado na tela de Categoria).
- Se o lojista não digitar um prefixo para a categoria, o sistema **deriva automaticamente do nome** (ex.: "Ciclídeos" → `CIC`) e mostra o resultado já preenchido, para o lojista confirmar ou ajustar.
- O prefixo é único dentro da loja — se a derivação automática colidir com um prefixo já existente, o sistema ajusta ou pede confirmação antes de salvar.
- Formato do código: `PREFIXO-NNNN` (número sequencial com zeros à esquerda). A sequência é **por categoria** — cada categoria começa contando do zero (ex.: `CIC-0001`, `CIC-0002`, e a próxima categoria começa em `RAC-0001`).
- O código é gerado no momento da criação do produto e **nunca muda depois** — mesmo que o produto seja movido para outra categoria no futuro, o código original é mantido (garante que pedidos e histórico do cliente continuem apontando para a referência certa).
- Ao cadastrar o produto, o lojista escolhe entre **código automático** (segue a regra acima) ou **código manual** (o sistema sugere o automático, mas o campo pode ser editado livremente — útil para quem está migrando de outro sistema e quer manter os códigos antigos).
- Cada produto tem um interruptor **"código visível na vitrine"**: se ligado, o código aparece na página do produto e o cliente consegue buscar por ele na loja; se desligado, o código existe só para uso interno do lojista.

**Revisão de 04/08/2026, ✅ implementada e testada em 05/08/2026 — o modo automático descrito acima (prefixo da categoria) não foi removido, virou uma opção explícita.** O cadastro de produto agora oferece **3 modos** de geração, claramente rotulados:

1. **Automático (novo padrão)** — o prefixo vem do **nome do produto** (mesma regra de derivação por palavras já usada em categoria: ex. "Ração de Fundo Pyotar" → `RAFP-0001`). Pensado para o caso comum de lojista que não quer se preocupar com prefixo de categoria — o sistema deriva sozinho do nome de cada produto.
2. **Herdar da categoria** — é exatamente o modo "automático" original descrito acima nesta seção (prefixo da categoria, ex. `RAC-0001`), preservado sem nenhuma mudança de comportamento para quem já usa esse padrão.
3. **Manual** — sem mudança, o lojista digita.

A sequência numérica do modo 1 é **por prefixo derivado**, não por categoria nem por produto — dois produtos com nomes diferentes que coincidentemente derivam o mesmo prefixo (ex.: dois produtos cujo nome deriva `RAFP`) dividem a mesma contagem (`RAFP-0001`, `RAFP-0002`), o mesmo papel do sufixo numérico como rede de segurança já usado no prefixo de categoria. Continuam valendo para os 3 modos: código gerado na criação, **nunca muda depois**, e o interruptor "código visível na vitrine".

### 4.7 Características por produto (ficha técnica)

**📐 Decidida — ✅ implementada e testada com Chromium real em 06/08/2026.** No cadastro/edição do produto, o lojista preenche os valores das características configuráveis da categoria escolhida (§4.3 — "Características por categoria": nome, tipo, opções, obrigatória, definidas pelo próprio lojista por categoria). É a ficha técnica do produto.

- **Aparece automaticamente ao escolher a categoria**: um bloco "Características" no formulário mostra um campo por característica **ativa** daquela categoria, com o controle certo para o tipo (texto → campo de texto, número → campo numérico, seleção → lista das opções cadastradas, sim/não → interruptor). Categoria sem nenhuma característica configurada simplesmente não mostra o bloco.
- **Reage à categoria selecionada**: mudar a categoria no formulário troca os campos mostrados para os da nova categoria — não existe herança entre categorias (já registrado em §4.3).
- **Obrigatoriedade**: característica marcada como obrigatória na categoria (§4.3) exige preenchimento para salvar o produto, tanto ao criar quanto ao editar. Validado no formulário (mensagem imediata, sem precisar tentar salvar pra descobrir) e novamente no servidor (garantia final, caso algo escape do formulário).
- **Troca de categoria na edição apaga os valores da categoria antiga**: se o lojista move um produto de categoria, os valores preenchidos para as características da categoria anterior são **descartados** (não ficam guardados escondidos) — o produto passa a usar só a ficha técnica da nova categoria, que começa vazia (a menos que já existisse algo salvo para ela antes, caso raro de ida-e-volta).
- **Característica inativada preserva o valor já preenchido**: se o lojista inativar uma característica na categoria (§4.3), ela some do formulário de produto imediatamente, mas o valor que já estava preenchido nos produtos **não é apagado** — fica guardado, pronto para reaparecer exatamente como estava se a característica for reativada depois. Evita perda de dado por uma decisão de configuração que pode ser revertida.

---

## 5. Entrega

**✅ Em vigor (cadastro de cidades)** — regras de uso no pedido ainda não implementadas.

- Entrega acontece em **ponto de encontro fixo por cidade** (não é entrega em domicílio).
- Cada cidade de entrega tem: ponto de encontro, horário, observações — cadastrados pelo painel (`/painel/cidades`).
- Cliente escolhe sua cidade de entrega no cadastro.

**📌 Decisões de produto da Fase 2 (Carrinho/Checkout), registradas com o PO em 15/08/2026, antes de qualquer implementação — ver `ESCOPO_PROJETO.md` §0 item 31.**

- **Tipo de entrega modelado de forma extensível**: o campo pensado pro checkout comporta mais de um tipo de entrega no futuro, mas o **MVP implementa só o modo que já existe** — ponto de encontro por cidade (`delivery_cities`, regras acima) — consumido por uma RPC pública **ainda a criar** (`get_public_delivery_cities`, pendência já identificada na Fase 0 da Vitrine — ver §8) e um seletor de cidade no checkout. Frete calculado, retirada em endereço fixo do lojista e envio por Correios/transportadora ficam como **fases futuras**, fora do MVP.
- **Taxa de entrega por cidade, com flag de habilitação**: cada cidade pode ter uma taxa de entrega, controlada por uma flag explícita "cobrar taxa" (sim/não) — só quando ligada é que o valor da taxa é considerado e somado ao total do pedido no checkout. Mesmo princípio de "flag separada do valor" da regra de valor mínimo do pedido (§11.4) — nunca "zero = sem taxa" como convenção implícita.

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

- **Carrinho e checkout**: regra de valor mínimo de pedido e quantidade mínima por variação **📌 decididas em 15/08/2026 — ver §§11–14 abaixo**; o que acontece se o estoque mudar entre adicionar ao carrinho e finalizar **continua em aberto** (depende do modo "bloquear pelo estoque", ainda não implementado — ver §12).
- **Reserva de estoque**: `store_settings.baixa_estoque_na_reserva` já existe no modelo (baixa no aceite vs. reserva na finalização, com expiração em minutos) — regra de negócio completa (o que acontece quando a reserva expira, notificação ao cliente) ainda não escrita. Relacionado ao modo "bloquear pelo estoque" (§12), que só entra junto da integração de pagamento — segue em aberto até lá.
- **Pedidos**: fluxo de aceite pelo staff, o que pode ser alterado pelo staff antes de aceitar, geração de PDF, envio por WhatsApp.
- **Pagamento**: fora do sistema no MVP — regra de como isso é registrado/conciliado ainda não definida.
- **Promoções por ciclo**: como um ciclo de vendas começa/termina e como isso se relaciona com `pedidos_abertos`.

**📌 Itens de roadmap registrados em 03/09/2026 (fechamento de sessão) — frentes futuras, ainda não iniciadas:**

- **Manual do Usuário da solução** — artefato próprio, em linguagem de usuário final, separado **por perfil** (lojista/equipe e cliente), tendo **`REGRAS_DE_NEGOCIO.md` como fonte da verdade**. É uma frente de trabalho dedicada, não um subproduto de outra tarefa.
- ~~**Redirecionamento após o logout → vitrine** (era o "item 3" original da lista de robustez de login, suspenso durante a investigação do item 50). Reavaliar agora **para onde** o logout deve levar, considerando que a equipe passou a ter "Ir para o painel" na vitrine (§1.1).~~ **✅ DECIDIDO E IMPLEMENTADO 04/09/2026.** O logout manual (equipe **e** cliente) passa a levar à **vitrine (`/`)** — **destino único** para os dois. Da vitrine, a equipe usa "Ir para o painel" (§1.1) e o cliente vê "Entrar". A limpeza da sessão não mudou (só o destino do redirecionamento). Testado na HML nos dois fluxos: cai em `/` com a sessão limpa (header volta a "Entrar"), "Entrar" funciona em seguida (sem a trava do item 50), relogin normal.
- **Política de expiração de sessão da equipe (staff) por segurança** — timeout por inatividade e/ou logout ao fechar o navegador, ponderando o risco de dispositivo compartilhado no balcão (§1.1). Decisão de produto, baixa prioridade.
- **Remover a instrumentação de diagnóstico `[login-debug]`** do fluxo de autenticação — depois que o PO confirmar o fechamento do item 50 no uso real; mudança técnica à parte, sem efeito de negócio.

**📌 Pendências registradas com o PO em 15/08/2026 (continuação da Fase 2 — §§15–16), a decidir nas próximas conversas ANTES de implementar:**

- **(a) Política de cancelamento configurável**: ~~manual pelo vendedor + automático por tempo (prazo a definir) — o que o cliente é avisado quando isso acontece, e como/quando o estoque reservado (§16) é liberado de volta.~~ **✅ Decidido com o PO em 18/08/2026** — ver §17 (cancelamento manual + automático configurável/desligável, libera estoque nos dois casos) e §18.1 (cliente notificado). Ainda não implementado, só decidido.
- **(b) Fluxo A (§15.3) em detalhe**: ~~o que exatamente significa o vendedor "validar" um pedido, e o que ele pode alterar no pedido antes de validar (ex.: substituir item indisponível, ajustar quantidade).~~ **✅ Decidido com o PO em 18/08/2026** — ver §15.4 (vendedor só pode reduzir/remover item ao validar, nunca aumentar nem adicionar item novo). Ainda não implementado, só decidido.
- **(c) Notificações**: ~~mecânica de disparo de e-mail + WhatsApp pro cliente (confirmação, validação, cancelamento) — o WhatsApp depende de uma integração ainda não escolhida/implementada (ex. Evolution API, já mencionada na visão original do produto).~~ **✅ Decidido com o PO em 18/08/2026** — ver §18 (e-mail + Área do Cliente "Meus Pedidos" no MVP; WhatsApp de saída via Evolution API no MVP; WhatsApp conversacional de entrada via N8N em fase seguinte, não MVP). Ainda não implementado, só decidido.
- **(d) Fluxo B (Asaas) completo**: integração de pagamento via Asaas, webhook de confirmação, atualização automática de status — ainda não esboçado em detalhe, entra junto da fase de pagamento. **Única pendência real que permanece em aberto desta lista.**
- **(e) Cliente convidado (sem conta) no checkout — pendência nova, registrada em 21/08/2026.** O incremento 5 (Checkout) implementou só o fluxo **cadastrado** (login obrigatório pra finalizar pedido — decisão registrada em §15, "Decisão do convidado"). Convidado (finalizar sem criar conta) fica pra uma fase futura, com escopo próprio ainda a desenhar: como verificar a identidade de quem finaliza sem exigir senha (ex.: confirmação por e-mail ou WhatsApp antes de aceitar o pedido — sem isso, a RPC ficaria aberta pra qualquer um se passar por qualquer nome/telefone/e-mail) e como esse cliente consulta/recupera o pedido depois, já que não tem sessão nem acesso a "Meus Pedidos" (incremento 6). Não é uma omissão — é a mesma cautela de segurança já aplicada nas migrations `033`/`035` (nunca confiar em identidade auto-declarada pelo client sem verificação).

---

## 9. Mensagens de erro — padrão geral do sistema

**✅ Em vigor a partir de 30/07/2026** — aplicar em toda funcionalidade nova; retroaplicar às existentes quando conveniente.

Toda mensagem de erro que o lojista ou o cliente final vê na tela segue três regras:

1. **Português claro** — sem tradução literal de termo técnico, sem inglês de banco de dados.
2. **Orienta a próxima ação** — diz o que fazer agora, não só descreve o problema (ex.: "Escolha outro" em vez de só "código duplicado").
3. **Zero jargão técnico** — nunca aparece código de erro (ex.: "23505"), nome de constraint/tabela/coluna, "RPC", stack trace, ou qualquer termo interno do sistema.

Exemplos: *"Já existe um produto com este código. Escolha outro."* em vez de *"duplicate key value violates unique constraint"*; *"Não foi possível salvar o produto. Tente novamente."* como mensagem genérica de fallback — nunca a mensagem crua do banco.

O detalhe técnico completo (código do erro do Postgres, nome da constraint, stack trace) continua existindo normalmente — só que **apenas no log do servidor/console**, nunca na tela do usuário. Ver `ESCOPO_PROJETO.md` §2 "Padrão de mensagens de erro" para o catálogo de mensagens já definido para a feature Código do Produto.

---

## 10. Isolamento entre lojas (multi-tenant)

**✅ Em vigor e testado a partir de 31/07/2026.**

Cada loja que usa a plataforma VLUMA só acessa os próprios dados — categorias, produtos, cidades de entrega, clientes, configurações. **Nunca enxerga nem consegue alterar dados de outra loja**, mesmo que as duas rodem sobre a mesma infraestrutura compartilhada. Isso vale tanto para a equipe (staff) quanto para o cliente final logado de cada loja.

Essa garantia não é só uma intenção de design — foi **testada de verdade**: criou-se uma segunda loja fictícia só para teste, e confirmou-se que uma pessoa da equipe dessa loja fictícia não via nada da loja do Cauã (nem o inverso). Numa primeira rodada de teste, dois pontos falhos foram encontrados e corrigidos antes de a garantia ser considerada válida — detalhe técnico completo em `ESCOPO_PROJETO.md` §2 e §5 (decisão #21).

**⚠️→✅ Atualização de 01/08/2026 — terceiro ponto falho encontrado e corrigido, desta vez na listagem de Produtos:** a garantia de isolamento acima valia para leitura direta de tabela, mas a tela de listagem do painel de Produtos consulta uma **view** (`products_com_status`), e essa view tinha o mesmo tipo de brecha por um motivo técnico diferente (não filtro de RLS ausente, e sim a view não herdar o RLS de quem consulta). Correção aplicada (migration `018`) e revalidada com o canário, desta vez consultando a view diretamente — ver `ESCOPO_PROJETO.md` §2 para o detalhe técnico completo. A garantia de isolamento desta seção agora cobre tabela **e** view.

---

## 11. Carrinho (Fase 2) — modelo e regras

**📐 Decidido com o PO em 15/08/2026, antes de qualquer implementação** — ver `ESCOPO_PROJETO.md` §0 item 31.

### 11.1 Modelo híbrido: carrinho começa no navegador, evolui pra persistido

O carrinho nasce **client-side** (vive no navegador do cliente, não numa tabela do banco) — é a base mais simples pra começar, sem exigir que o cliente esteja logado só pra montar um pedido. A arquitetura já é pensada desde agora pra **evoluir pra um carrinho persistido** (associado à conta do cliente) assim que houver identificação — por exemplo, o cliente loga no meio da navegação e o carrinho migra pro servidor, sem perder o que já tinha montado. Todas as regras que o carrinho aplica (quantidade mínima, valor mínimo, disponibilidade) são sempre **lidas da configuração do tenant** (`store_settings`) — nunca um valor fixo no código do carrinho.

### 11.2 Quantidade mínima por variação

Ao adicionar um item ao carrinho, o sistema respeita `quantidade_minima_venda` da variação (já modelado desde a migration `027`) — não deixa adicionar menos que o mínimo definido pelo lojista pra aquela variação específica.

### 11.3 Bloqueio de "pedidos fechados" acontece no carrinho, não numa tela separada

Reforça a regra já registrada em §2: quando `pedidos_abertos = false`, o cliente continua navegando a vitrine inteira normalmente (produtos, preços, disponibilidade) — o bloqueio só acontece no momento em que ele tenta **adicionar um item ao carrinho**, mostrando `mensagem_pedidos_fechados`. Não existe uma tela de checkout separada pra esse aviso; é parte do próprio fluxo do carrinho.

### 11.4 Valor mínimo de pedido: flag de habilitação + valor, nunca "zero = desativado"

`store_settings.valor_minimo_pedido` (já existe) passa a ser controlado por uma **flag de habilitação explícita**, separada do valor numérico — decisão deliberada do PO pra nunca usar "R$0,00 = sem mínimo" como convenção implícita: um valor zero configurado por engano (ou de propósito, por algum motivo do lojista) não pode ser confundido com "a regra está desligada". A flag decide se a regra vale; o valor só é considerado quando a flag está ligada.

---

## 12. Controle de estoque na vitrine — dois modos configuráveis

**📐 Decidido com o PO em 15/08/2026.**

O lojista escolhe, por configuração (nunca fixo no código), como o estoque se comporta na vitrine pública:

| Modo | Comportamento | Quando entra |
|---|---|---|
| **Bloquear pelo estoque** | A vitrine revela a disponibilidade real (esgotado/disponível calculado do saldo) e o sistema reserva/bloqueia em tempo real — pensado pro cenário em que o cliente **paga no ato** (precisa impedir vender o que não existe mais no estoque). | Implementado **junto da integração de pagamento** (fase futura) — não faz sentido bloquear estoque em tempo real sem cobrar na hora. |
| **Não bloquear** | O estoque fica **oculto** (nenhum número, nenhuma reserva em tempo real) — o pedido entra como solicitação, sujeita à confirmação do lojista depois (fluxo de aceite, já modelado nos Pedidos). | Implementado **no MVP** — modo mais simples, compatível com o pagamento fora do sistema (padrão atual). |

A **configuração** dos dois modos (qual está ativo) é modelada agora, na Fase 2 — mesmo que só o modo "não bloquear" tenha comportamento implementado no MVP.

**📌 Refinado com o PO em 18/08/2026 — ver §16.4.** O mecanismo exato de "Bloquear pelo estoque" ficou mais preciso: é a reserva **"leve" com expiração desde o próprio carrinho** (não só uma checagem no fechamento do pedido) — o modelo-alvo de mercado. Tabela acima continua válida sem mudança de fundo, só ganhou mais precisão de mecanismo — o adiamento pra "junto da integração de pagamento" continua o mesmo, agora com o motivo explicado em detalhe em §16.4.

---

## 13. Módulo de Configuração do Carrinho (painel)

**📐 Decidido com o PO em 15/08/2026.**

Agrupa as configurações do carrinho num só lugar do painel: a flag + valor do pedido mínimo (§11.4) e o modo de controle de estoque (§12). Os campos são modelados em `store_settings` já na Fase 2; a **tela** de edição no painel fica pra fase de polimento, dentro do agrupamento "Configurações" já decidido pra navegação do painel (`ESCOPO_PROJETO.md` §0 item 30/decisão #27) — mesmo padrão já usado nas Configurações da Vitrine (Etapa 4): campo modelado primeiro, tela de edição depois.

---

## 14. Contas de cliente

**📐 Decidido com o PO em 15/08/2026.**

- O sistema de contas de cliente nasce **já no MVP** (não é uma fase futura) — reaproveita a base de autenticação já existente (Supabase Auth + o trigger `handle_new_user`, que já distingue o destino do cadastro conforme a metadata do signup).
- Staff (painel) e Cliente (vitrine) continuam sendo distinguidos **por papel**, nunca a mesma conta sendo as duas coisas (mesma regra já em vigor, §1) — reforçado aqui como **ponto de segurança crítico** desta fase: cliente nunca acessa o painel, staff nunca aparece como cliente na vitrine, com o **mesmo rigor** já aplicado ao isolamento entre lojas (§10).
- **Base de clientes robusta desde já**: todo cliente que gera um pedido — **cadastrado** (com login) ou **convidado** (sem conta) — vira um registro vinculado ao contato (nome/telefone/e-mail), e cada pedido fica vinculado a esse registro de cliente. O fluxo **cadastrado é o principal** (login persiste histórico e dados entre visitas); o fluxo **convidado é um complemento secundário** (facilita a conversão de quem não quer criar conta na hora), não o caminho preferencial.

### 14.1 Mensagem de "e-mail já cadastrado" é sempre NEUTRA — nunca revela se o e-mail existe

**📐 Decidido com o PO em 20/08/2026. ✅ Implementado e testado com Chromium real contra a URL pública em 20/08/2026 — fecha o Bug 1 registrado em `ESCOPO_PROJETO.md` §0.**

Quando um cadastro é tentado com um e-mail que já tem conta, a mensagem mostrada ao cliente **nunca confirma nem nega** que aquele e-mail já está cadastrado — decisão de produto pensada pro SaaS (qualquer lojista, não só o Cauã), não uma peculiaridade desta loja. Motivo: revelar "esse e-mail já existe" ajuda um atacante a enumerar quais endereços têm conta na plataforma (varrer uma lista de e-mails e descobrir quais "batem"), o mesmo raciocínio de segurança que já motiva o próprio Supabase Auth a devolver sucesso silencioso (sem erro, sem criar nada) numa tentativa de `signUp()` com e-mail existente. A tela deve reagir a esse caso de forma que **pareça idêntica** à de um cadastro novo bem-sucedido (mesma mensagem "confirme seu e-mail", por exemplo) — nunca um alerta específico tipo "este e-mail já possui cadastro". Detecção técnica: `data.user.identities.length === 0` na resposta do `signUp()` é o sinal (documentado do Supabase) de que nada foi criado de verdade — usado só pra decidir o comportamento interno (ex.: não reenviar e-mail de um jeito diferente), nunca pra mudar a mensagem visível de um jeito que entregue a informação ao cliente.

**Texto final aprovado pelo PO e implementado em `cadastro-form.tsx`:** *"Se este e-mail ainda não estiver cadastrado, você receberá um link de confirmação em instantes. Se você já tem uma conta com este e-mail, use a opção de entrar ou recuperar sua senha."* — substitui a mensagem antiga ("Enviamos um link de confirmação para..."), que afirmava um fato ("enviamos") que não é verdade no caso de e-mail já existente (nesse caso o Supabase não envia nada). O botão "Reenviar e-mail" também foi normalizado: o resultado do `resend()` do Supabase (que falha de forma diferente para um e-mail já confirmado) não é mais repassado como erro visível — sempre mostra "E-mail reenviado", pra não abrir um segundo canal de enumeração pela mesma tela.

**Teste realizado (Chromium real, `ecommercecauahml.vluma.com.br`):** criada uma conta pré-existente e confirmada via Admin API (setup de teste, não o fluxo sendo testado) e uma conta nova via `/cadastro`. As duas tentativas de cadastro — e-mail novo e e-mail já existente — produziram exatamente a mesma tela (`heading` e corpo do texto idênticos, sem nenhuma palavra reveladora tipo "já cadastrado"). Confirmado no banco: o e-mail novo gerou exatamente 1 linha em `customers`; o e-mail já existente continuou com exatamente 1 linha (nenhuma duplicata criada pela segunda tentativa). Usuários de teste removidos ao final, zero resíduo.

### 14.2 WhatsApp sem restrição de unicidade — decisão consciente, não descuido

**📐 Decidido com o PO em 20/08/2026.**

`customers.whatsapp` **não tem** nem vai ganhar, por enquanto, nenhuma restrição de unicidade — o mesmo número de telefone pode estar associado a mais de uma conta de cliente. O identificador único de conta é o **e-mail** (login), não o telefone. Decisão consciente, não uma lacuna esquecida: casos legítimos existem (familiares/funcionários compartilhando um número de contato, ou alguém que cria uma segunda conta com e-mail diferente mas mesmo WhatsApp) — impor unicidade aqui bloquearia esses casos sem necessidade real de negócio identificada até agora. Revisável no futuro se surgir um motivo concreto.

### 14.3 Cidade de entrega sai do cadastro — pertence ao checkout/conta, não à criação da conta

**📐 Decidido com o PO em 24/08/2026. ✅ Implementado e testado com Chromium real contra a URL pública no mesmo dia.**

O cadastro (`/cadastro`) **não pede mais cidade de entrega** — coleta só nome, e-mail, WhatsApp e senha. Dois motivos, os dois de produto:

- **Acoplamento errado**: "ponto de encontro por cidade" é a modalidade de entrega hoje usada pelo Cauã (§5), não algo universal — uma loja com Correios, transportadora ou retirada em endereço fixo não teria "cidade de entrega" nenhuma pra pedir no cadastro. Pedir isso na criação de conta amarra o cadastro (peça de infraestrutura, deveria servir qualquer lojista do SaaS) a uma decisão operacional de uma loja específica.
- **Momento errado**: onde receber pertence à decisão da **compra** (checkout, passo de Entrega — §15.1), não ao momento de só criar uma conta. Perguntar no cadastro adianta uma escolha que só faz sentido no contexto de um pedido real sendo montado.

`customers.delivery_city_id` continua existindo, nullable (sem mudança de schema — já era nullable desde a migration `005`, `handle_new_user`/migration `033` já tratava a ausência do campo como `null` de propósito, com `nullif` + `try/catch` de segurança). Nasce **nulo** em todo cadastro novo; é preenchido normalmente no checkout (o passo de Entrega já bloqueia "Continuar" até uma cidade ser escolhida, com ou sem valor prévio) ou depois em `/minha-conta` (§18.4). Cliente que já tinha `delivery_city_id` preenchido antes desta mudança **não é afetado** — o campo só deixou de ser perguntado em telas novas, nenhum dado existente foi tocado.

**Teste completo (Chromium real, `ecommercecauahml.vluma.com.br`)**: formulário de `/cadastro` confirmado sem nenhum campo/texto de cidade; cadastro real via UI (sem escolher cidade nenhuma, porque não há onde escolher) — `customers` criado corretamente com `delivery_city_id = null` (confirma que `handle_new_user` não erra com o campo ausente); logado em seguida, checkout no passo de Entrega mostra o seletor de cidade normalmente, "Continuar" desabilitado até escolher (cliente realmente sem cidade prévia) e habilitado depois de escolher; `/minha-conta` confirmado ainda mostrando o campo de cidade, editável. Zero resíduo de teste (nenhuma conta/pedido de teste sobrou).

---

## 15. Checkout — fluxo e identificação (Fase 2)

**📐 Decidido com o PO em 15/08/2026, complementa §§11–14. ✅ Implementado e testado com Chromium real contra a URL pública em 21/08/2026 — Fase 2, incremento 5 do roteiro (`ESCOPO_PROJETO.md` §0).**

**Decisão do convidado (Opção A aprovada com o PO em 21/08/2026): checkout exige cliente logado, não suporta convidado neste incremento.** Motivo decisivo: suportar convidado exigiria abrir a RPC `criar_pedido` pra `anon` e confiar em identidade auto-declarada pelo client (nome/e-mail/telefone sem verificação de posse) — quebra o mesmo princípio de segurança já reforçado nas migrations `033`/`035` (nunca confiar em identidade que o client possa forjar). Com login obrigatório: zero mudança de banco (`criar_pedido`/RLS já foram construídas e testadas assumindo isso desde a migration `037`), "Meus Pedidos" (incremento 6) sai de graça (todo pedido já nasce vinculado a uma conta com sessão), e alinha com a decisão já registrada em §14 (fluxo cadastrado é o principal). **Convidado fica registrado como pendência explícita de fase futura**, com escopo próprio ainda a desenhar: verificação de identidade sem conta (ex.: confirmação por e-mail/WhatsApp antes de aceitar o pedido) + como o convidado recupera/consulta o pedido depois (sem sessão, sem "Meus Pedidos").

**Fluxo implementado**: gate de sessão (`/checkout` mostra "Entre para finalizar seu pedido" com botões Entrar/Criar conta, ambos propagando `?proximo=/checkout` — inclusive pelo link REAL de confirmação de e-mail do `/cadastro`, que agora aceita e repassa esse destino) → Identificação (dados da sessão, somente leitura) → Entrega (cidade via `get_public_delivery_cities`, migration 032) → Revisão (itens do carrinho, observação livre, **valor mínimo vira bloqueio real** — botão "Finalizar pedido" desabilitado quando a flag está ligada e o total fica abaixo, diferente do aviso apenas informativo do carrinho, §11.4) → Confirmação (número do pedido, com aviso explícito de que ainda não há e-mail de confirmação nem "Meus Pedidos" nesta fase — só a tela na hora, incrementos 6/8 ainda não existem).

**Dois bugs reais encontrados e corrigidos durante o teste de ponta a ponta com Chromium (não hipotéticos):**
1. **Passo do wizard na URL causava round-trip desnecessário ao servidor.** Primeira versão guardava o passo atual em `?passo=` (mesmo padrão de filtro usado no painel, via `useQueryParamState`) — só que trocar de passo faz o Next.js re-executar o Server Component da rota inteira (refaz `getCustomerProfile` + `get_public_delivery_cities`), lento e sem necessidade nenhuma (o passo é 100% decisão de UI, os dados já estão carregados). Corrigido pra estado local (`useState`), sem persistir na URL.
2. **`criar_pedido` chamada direto do browser sempre falhava com "Não foi possível identificar sua conta" mesmo com o cliente logado de verdade.** Causa raiz: a sessão deste app vive em cookies **httpOnly** (setados por `/api/auth/login`), ilegíveis por `document.cookie` — o client do navegador (`createBrowserClient`) nunca enxergava essa sessão (mesmo com o Server Component da página confirmando a sessão certinho via `getCustomerProfile()`), então toda chamada RPC autenticada feita direto do browser resolvia `auth.uid()` como nulo. Corrigido criando um Route Handler (`POST /api/loja/checkout`) que usa o client SERVIDOR (`cookies()` do Next, mesmo padrão já usado em todo o painel) pra chamar a RPC — só esse client consegue ler a sessão. **Lição pro projeto**: qualquer chamada RPC que dependa de `auth.uid()`/sessão precisa passar por um Route Handler com o client servidor — nunca `supabase.rpc()` direto de um Client Component, mesmo que o padrão de `/cadastro` (que chama `signUp()`/`resend()` direto do browser) sugira o contrário — esses métodos de Auth são diferentes por criarem a própria sessão na hora, não dependem de uma sessão pré-existente vinda de cookies do servidor.

**Teste completo (Chromium real, cliente de teste + produto real, tudo revertido/limpo ao final)**: (a) checkout deslogado mostra o gate, `?proximo=/checkout` correto nos dois botões, carrinho preservado ao voltar; (b) logado (via `?proximo=/checkout`) cai direto no checkout, Identificação/Entrega (cidade pré-preenchida da conta)/Revisão funcionando; (c) valor mínimo ligado bloqueia mesmo o botão de finalizar (não só avisa); (d) finalizar com sucesso confirmado no banco — `orders`/`order_items` corretos, número sequencial batendo com a tela, `status='aguardando_validacao'`, **saldo de estoque e `stock_movements` intocados** (zero movimento, conforme §16.4), carrinho limpo depois; (e) `pedidos_abertos=false` rejeitado pela RPC com a mensagem amigável certa ("Os pedidos deste ciclo ainda não começaram."), sem criar pedido nenhum. Zero resíduo de teste no banco ao final (usuário, pedido e `store_settings` revertidos/removidos).

**🔴→✅ Terceiro bug real, bloqueador, encontrado pelo usuário no teste manual de ponta a ponta em 21/08/2026 (não pelo teste automatizado acima — ver `ESCOPO_PROJETO.md` §0 item 48 pro diagnóstico completo).** `POST /api/loja/checkout` retornava 401 ("Você precisa estar logado") mesmo com o cliente logado de verdade — nenhum cliente conseguia finalizar pedido. **Causa raiz: não era bug de código** — o mecanismo de `getCustomerProfile()`/renovação de sessão do Route Handler foi provado correto (testado com Chromium real deixando o token expirar de propósito, só esperando o tempo real passar, sem mexer em nada — o Route Handler renovou sozinho e o pedido foi criado). O problema era o **JWT expiry do projeto Supabase preso em 60 segundos** — resíduo de um diagnóstico anterior (item 18/§2, 10/08/2026) que a documentação registrou como "revertido pra 3600s" mas nunca foi revertido de verdade em produção. Com 60s de vida, o wizard do checkout (3 passos client-side, **sem nenhum round-trip ao servidor entre eles** — §15.1, decisão deliberada de UX) dava tempo de sobra pro token expirar antes do cliente clicar "Finalizar", em qualquer uso humano real (não em testes automatizados rápidos, que sempre passaram por rodarem rápido demais pra sentir o efeito). **Corrigido pelo usuário revertendo o JWT expiry pra 3600s no dashboard — sem nenhuma mudança de código —, confirmado com um pedido real finalizado com sucesso.** Lição de processo: uma configuração registrada como "revertida" no documento não garante que foi revertida de verdade no sistema real, principalmente fora do controle de versão (dashboard, variável de ambiente) — verificar no sistema ao vivo, não só confiar no texto do doc.

**Recomendação de configuração registrada (24/08/2026, não urgente — o bug principal já está resolvido)**: o usuário vai conferir/ajustar o "Refresh Token Rotation reuse interval" do projeto Supabase pra 10s (padrão recomendado do próprio Supabase) da próxima vez que passar pelo dashboard, como precaução extra contra renovações concorrentes de sessão — não confirmado se esse parâmetro foi tocado junto da correção do JWT expiry acima.

**Ajuste de UX, achado pelo usuário no teste manual completo (24/08/2026) — ✅ implementado e testado com Chromium real no mesmo dia.** A tela de Revisão não permitia nenhum ajuste (mudar quantidade, remover item) — único jeito de corrigir algo era abandonar o checkout. **Decisão de UX (aprovada pelo PO)**: edição **inline** na própria Revisão, reaproveitando `alterarQuantidade`/`removerItem` do mesmo `useCarrinho` já usado no drawer do carrinho (mesmo stepper de quantidade respeitando `quantidade_minima_venda`, mesmo botão de remover) — nunca sai de `/checkout`, então `cidadeId`/`observacao` (estado local do wizard) nunca se perdem, sem precisar de nenhum mecanismo novo de persistência entre navegações. **Testado com Chromium real, carrinho com 2 produtos diferentes**: aumentar quantidade recalcula o total na hora; remover um item recalcula o total e não deixa vazar o item removido; **cidade escolhida e observação digitada confirmadas intactas depois dos dois ajustes** (o ponto central do pedido); remover o último item cai corretamente no estado "carrinho vazio" já existente. Zero resíduo de teste (nenhum pedido chegou a ser finalizado nesses testes).

**Ajuste de tipografia dos preços, achado pelo usuário no mesmo teste manual — ✅ implementado e testado com Chromium real em 24/08/2026.** O preço "hero" da ficha de produto e o Total da Revisão usavam `font-display` (Syne, a fonte decorativa da marca) — preço é dado transacional que o cliente lê rápido e confere, não título de vitrine, ainda mais no Total (o valor que ele está prestes a pagar). "R$" também tinha o mesmo peso/tamanho do número, competindo por atenção. Corrigido com um componente novo (`src/components/ui/preco.tsx`, `Preco`) que separa símbolo e valor via `Intl.NumberFormat().formatToParts()` — "R$" menor, peso reduzido, cor secundária; número no peso/tamanho de destaque, sempre na fonte de corpo (nunca `font-display`). Aplicado nos dois preços "hero" — os subtotais de item (drawer, variação, linha de item da Revisão) já usavam a fonte certa, sem mudança. Confirmado visualmente com Chromium real nas duas telas.

### 15.1 Checkout em passo a passo, não página única

O checkout é um fluxo em **etapas sequenciais**, não uma página única com tudo junto: **Identificação → Entrega → Revisão/Confirmação**. Pagamento entra como uma etapa a mais quando o Fluxo B (Asaas, abaixo) for implementado. Decisão de UX: reduz a sobrecarga de uma tela só com tudo de uma vez, e facilita evoluir o fluxo (inserir/reordenar etapas) sem reescrever tudo do zero.

### 15.2 Identificação do cliente — login por e-mail

- Identificador de login: **e-mail** — reaproveita o Supabase Auth nativo (mesmo mecanismo já usado por staff, via `handle_new_user`), sem o custo/complexidade de verificação por SMS.
- Cadastro do cliente coleta: nome, e-mail (login), **telefone/WhatsApp — obrigatório** (é o canal de contato e de coordenação de entrega, não só um dado de perfil), senha.
- Login por telefone é uma evolução futura, fora do MVP.

### 15.3 Dois fluxos de checkout, conforme o pagamento

| | Fluxo A — não integrado (**MVP**) | Fluxo B — integrado via Asaas (**fase futura**) |
|---|---|---|
| Pagamento | Na entrega, fora do sistema | Pela plataforma, no ato da finalização |
| Depois de finalizar | Pedido entra como "aguardando validação" na área de Pedidos | Sistema recebe confirmação via webhook do Asaas, status atualiza sozinho |
| Validação | Vendedor confirma que atende (aceite manual) | Automática, pela confirmação de pagamento |
| Notificação ao cliente | E-mail + WhatsApp | E-mail + WhatsApp |
| Modo de estoque (§12) | "Não bloquear" | "Bloquear pelo estoque" |

O Fluxo A é o que entra no MVP — casa com "pagamento fora do sistema" (§8) e com o modo de estoque "não bloquear" (§12). O Fluxo B entra junto da integração de pagamento (Asaas), fase futura, ainda não esboçado em detalhe — ver pendências em §8.

### 15.4 Edição do pedido pelo vendedor ao validar (Fluxo A) — só pode reduzir, nunca aumentar

**📐 Decidido com o PO em 18/08/2026, detalha "Validação" do Fluxo A (§15.3 acima).**

Ao validar um pedido do Fluxo A, o vendedor pode ajustar o pedido **sem precisar cancelar o pedido inteiro** — mas só numa direção: **reduzir quantidade ou remover itens** (ex.: item que acabou entre o pedido e a conferência de estoque). O vendedor **nunca pode aumentar quantidade nem adicionar item novo** ao validar — isso elevaria o compromisso do cliente sem uma nova confirmação dele, o que fica fora do MVP (fase futura, se vier a ser necessário).

Consequência prática: o ajuste é sempre **a favor do cliente** — o total do pedido só pode diminuir nessa etapa, nunca aumentar. O estoque correspondente às reduções/remoções volta pro saldo disponível (mesma liberação de §16/§17). O cliente é notificado do ajuste — ver §18.

**Desenho decidido com o PO em 21/08/2026 (Fase 2, incremento 7), migration `039` — ✅ implementado e testado com sessões reais em 21/08/2026 (sem tela ainda, RPCs chamadas direto).** Nota de correção, mesmo princípio já registrado em §17.2: "Editar" (RPC `ajustar_itens_pedido`) só é permitido enquanto o pedido está `aguardando_validacao` — estado que **nunca reservou estoque nenhum** (§16.4) — então reduzir/remover um item aqui não "devolve" nada, simplesmente nunca chegou a ser baixado. É só a partir da **validação** (`validar_pedido`) que o estoque é baixado de verdade; se o vendedor precisar reduzir um pedido **já confirmado**, o caminho é cancelar (`cancelar_pedido`, §17.1), que aí sim devolve o que foi baixado. **Estoque insuficiente ao validar é tratado como tudo-ou-nada**: se qualquer item do pedido não tiver saldo suficiente, a validação inteira é recusada (nenhum item é baixado, reaproveitando a garantia de saldo não-negativo que o módulo de Estoque já impõe desde a migration 021) — o vendedor usa "Editar" pra resolver o item problemático e tenta validar de novo, em vez do sistema decidir sozinho o que ignorar ou permitir saldo negativo. **Permissão**: "Validar", "Editar", "Cancelar" e "Concluir" exigem a mesma permissão (`profiles.pode_aceitar_pedido` — admin sempre tem, operador só se essa flag individual estiver ligada, §1) — regra única, quem decide o destino do pedido decide pras quatro ações.

---

## 16. Reserva de estoque na finalização do pedido

**📐 Decidido com o PO em 15/08/2026.**

### 16.1 Reserva acontece na finalização, não fica "solta"

Ao finalizar o pedido (Fluxo A ou B), o estoque correspondente é **reservado/consumido imediatamente** — não fica solto esperando validação do vendedor. O próximo cliente que olhar aquele produto já vê esgotado, se o saldo acabou com esse pedido. Evita frustrar um segundo cliente com um item que "acabou depois" — mesmo item que ele via disponível segundos antes. É o padrão de mercado: reserva **na submissão do pedido**, não na validação. Usa `store_settings.baixa_estoque_na_reserva` (já existe no modelo) e a baixa atômica via RPC com `FOR UPDATE` (já prevista pra fase de Pedidos — evita dois pedidos disputando o mesmo saldo ao mesmo tempo).

**⚠️ Nota de revisão (18/08/2026) — ver §16.4 abaixo.** O texto acima descreve o modelo-alvo de mercado, mas a decisão original havia sido influenciada pela operação específica do Cauã (cliente único, sem disputa real de estoque hoje), não pelo princípio de produto. Revisado com o PO: o modelo-alvo de verdade reserva desde o **carrinho** (não só na finalização) e fica deliberadamente adiado pra fase de pagamento/Fluxo B. O MVP (Fluxo A) tem comportamento mais simples — baixa na **validação**, não na finalização — ver §16.4 pro detalhe completo e o motivo do adiamento.

### 16.2 Reserva modelada como registro com estado, não um decremento simples

A reserva nasce como um **registro próprio** (pedido X reservou N unidades da variação Y), com estado e noção de expiração — não é só subtrair direto do saldo. No MVP só existe a reserva **"firme"** (feita na finalização do pedido, sem expiração). A estrutura já é desenhada, porém, pra comportar **sem reescrita** a reserva **"leve"** durante o próprio checkout (antes de finalizar, com expiração automática se o cliente abandonar) — peça que entra junto da fase de pagamento/Fluxo B. Mesmo princípio de "preparar a estrutura sem pagar o custo de implementar agora" já usado no carrinho client-side (§11.1).

### 16.3 Carrinho não reserva estoque — só o pedido reserva

**📐 Decidido com o PO em 18/08/2026, complementa §11.1 e §16.1.**

O carrinho (client-side, §11.1) nunca reserva estoque — a reserva só existe a partir do pedido, no momento da finalização (§16.1). Consequência prática: um carrinho abandonado (cliente fecha a aba, esquece o navegador aberto, etc.) não precisa liberar nada — ele nunca reservou nada pra começar, então simplesmente some sem nenhum efeito colateral no estoque.

A reserva "leve" desde o próprio carrinho (com expiração automática, pra segurar o estoque enquanto o cliente ainda está decidindo) é o modelo mais sofisticado já previsto na estrutura de dados (§16.2), mas **não implementado no MVP** — fica para quando o Fluxo B/Asaas (§15.3) entrar, junto do modo "bloquear pelo estoque" (§12), cenário onde essa garantia em tempo real realmente importa (pagamento no ato).

### 16.4 Revisão de princípio (18/08/2026): modelo-alvo é reserva desde o carrinho, adiada pro Fluxo B; MVP baixa estoque na validação

**📐 Revisado com o PO em 18/08/2026, corrige o comportamento de MVP descrito em §16.1 — complementa §12/§15.3/§15.4.**

**Correção de princípio.** A decisão original de §16.1 (reserva/baixa na finalização do pedido, já pro MVP) havia sido influenciada pela operação específica do Cauã (cliente único, sem disputa real de estoque por múltiplos clientes simultâneos hoje) — não pelo princípio de produto, que precisa valer pra qualquer lojista do segmento (mesmo critério norteador já registrado no topo de `ESCOPO_PROJETO.md`: "isso serve qualquer lojista?", não "o Cauã precisa disso?"). O PO identificou essa influência indevida e corrigiu a decisão.

**Modelo-alvo, confirmado como o correto e robusto — é o padrão de mercado das plataformas maduras.** O check e a reserva de disponibilidade de estoque devem acontecer **já ao adicionar o item ao carrinho** — reserva "leve" com expiração (a peça que §16.2 já previa na estrutura) — não só no fechamento do pedido. Avisa o cliente **cedo**, enquanto ainda está navegando/montando o pedido, em vez de barrá-lo só no fim do checkout, depois de todo o esforço de preencher entrega/identificação/etc. Exige carrinho persistido no **servidor** (evolução já prevista em §11.1, não mais só client-side) e tratamento de concorrência entre carrinhos simultâneos disputando o mesmo saldo.

**Adiamento deliberado, não esquecimento.** Esse modelo-alvo é significativamente mais pesado de construir (carrinho no servidor, reserva com expiração, tratamento de concorrência) — fica **deliberadamente** pra fase de pagamento/Fluxo B (Asaas), onde reserva e pagamento andam juntos e o modelo faz sentido completo (não há por que reservar estoque em tempo real sem cobrar na hora — mesmo raciocínio já registrado em §12 pro modo "bloquear pelo estoque"). Motivo do adiamento: fechar o end-to-end do MVP mais rápido, colocando o Cauã em produção antes, trazendo a reserva robusta logo em seguida.

**MVP (Fluxo A) — o que se implementa agora.** Modo "não bloquear" (§12) na prática completa: o pedido entra como **solicitação** — **sem** reservar nem baixar estoque na criação. O vendedor valida (§15.4) e é **na validação** que a baixa de estoque acontece de verdade — o vendedor confirma o que consegue atender, ajustando ou removendo itens sem saldo suficiente através da edição de pedido já decidida (§15.4: só reduzir/remover, nunca aumentar). `store_settings.baixa_estoque_na_reserva = false` nesse modo. Coerente com o estoque ficar oculto na vitrine (§12) e com a validação manual do vendedor já ser o ponto de controle do Fluxo A.

**A proteção contra "dois clientes pedindo o último item ao mesmo tempo" vem do modelo-alvo (reserva desde o carrinho), não do MVP** — no MVP essa disputa é resolvida manualmente pelo vendedor na validação (ele vê os pedidos concorrentes e decide), não automaticamente pelo sistema. Isso resolve a pendência já registrada em §8 ("o que acontece se o estoque mudar entre adicionar ao carrinho e finalizar continua em aberto") — a resposta pro MVP é: fica em aberto por design, resolvido manualmente na validação; o fechamento automático só chega com o modelo-alvo do Fluxo B.

---

## 17. Cancelamento de pedido (Fase 2)

**📐 Decidido com o PO em 18/08/2026.**

O MVP tem dois caminhos de cancelamento, não excludentes entre si:

### 17.1 Cancelamento manual pelo vendedor

O vendedor pode recusar/cancelar um pedido (por exemplo, ao validar — §15.3/§15.4 — e perceber que não consegue atender). Ao cancelar, o estoque reservado por aquele pedido (§16) é liberado de volta pro saldo disponível.

### 17.2 Cancelamento automático por tempo, configurável

Pedido que fica **não validado** por mais que um prazo configurado é cancelado automaticamente, liberando o estoque reservado — evita "pedido zumbi" segurando estoque indefinidamente sem o vendedor nunca ter respondido. Dois pontos deliberados:

- **Prazo configurável pelo lojista** (não um valor fixo no código) — cada loja decide quantos dias/horas fazem sentido pro próprio ritmo de validação.
- **Desligável**: o lojista pode desativar o cancelamento automático por completo, se preferir controlar isso manualmente. Padrão de fábrica é **conservador** (ligado, com um prazo razoável) — mesmo princípio de "nunca esconder uma regra atrás de comportamento implícito" já usado noutras flags do sistema (§11.4, §5).

Em ambos os casos (manual ou automático), o cliente é notificado do cancelamento — ver §18.

**Mecanismo decidido com o PO em 21/08/2026 (Fase 2, incremento 7), migration `039` — ✅ implementado e testado com sessões reais em 21/08/2026 (sem tela ainda, RPCs chamadas direto).** Nota de correção: pedido `aguardando_validacao` (o único estado que o cancelamento automático alcança) **nunca reservou estoque** (§16.4 — a baixa só acontece na validação) — "liberando o estoque reservado" no parágrafo acima é a formulação original da decisão de 18/08, mas na prática o cancelamento automático não gera nenhum movimento de estoque, porque nunca houve baixa pra desfazer nesse estado. O mecanismo em si: RPC `cancelar_pedidos_expirados()`, chamada por um **GitHub Action cron** (mesmo padrão já em produção do `keepalive_ping`, `.github/workflows/keepalive.yml`), sem sessão de usuário nenhuma — a RPC nunca depende de `auth.uid()`/`is_staff()` pra decidir o que cancelar, só das condições estritas do prazo/flag configurados em cada tenant. Escolhido em vez de verificação sob demanda (checar validade toda vez que o painel de pedidos é aberto) por rodar de forma confiável mesmo em dias sem nenhum staff logado — evita pedido zumbi ficar parado indefinidamente só porque ninguém abriu o painel.

**✅ Workflow implementado em 21/08/2026 — `.github/workflows/cancelar-pedidos-expirados.yml`.** Roda de hora em hora (`workflow_dispatch` também disponível pra disparo manual) — a RPC é idempotente e autolimitada (só cancela o que já passou do prazo configurado por tenant), então uma janela de até 1h de atraso é irrelevante contra um prazo default de 48h. Chama `POST {SUPABASE_URL}/rest/v1/rpc/cancelar_pedidos_expirados` com a `anon key` (mesmos secrets já usados pelo `keepalive.yml`, nenhum novo). **Chamada validada de verdade**: reproduzida a mesma chamada (mesmo endpoint, mesma `anon key`) fora do workflow — HTTP 200, retornou `0` pedidos cancelados (esperado, sem pedido vencido no banco no momento do teste). O disparo do workflow em si dentro do GitHub Actions (via `workflow_dispatch`) não foi executado nesta sessão — sem `gh` CLI disponível e sem um token de API do GitHub com permissão liberada pra chamar a API de Actions (bloqueado pelo classificador de auto-modo do harness ao tentar). Recomendado ao usuário disparar manualmente pela aba Actions do GitHub como confirmação final de que o YAML roda igual no runner.

### 17.3 Cancelamento pelo cliente — frente futura, mecanismo configurável (NÃO construir agora)

**📌 Registrado com o PO em 26/08/2026 — só registro de roadmap, nenhuma implementação.** Hoje só o lojista cancela um pedido (§17.1) ou o sistema cancela automaticamente por prazo (§17.2) — o **cliente** não tem como cancelar o próprio pedido.

**Princípio de produto decidido**: quando construído, é um **mecanismo configurável pelo lojista**, nunca uma regra fixa no código. O **produto** oferece a capacidade técnica; a **política** (se cancelamento pelo cliente é permitido, em que condições) é decisão de cada lojista, não da VLUMA. Motivo explícito: política de cancelamento varia por tipo de negócio e tem implicações jurídicas (ex.: direito de arrependimento do CDC, prazos e condições que variam por segmento/produto) que são responsabilidade do lojista definir com o próprio jurídico — o produto não codifica lei, só entrega alavancas configuráveis (mesmo princípio de "flag explícita, nunca comportamento implícito" já usado em §11.4/§17.2).

**O que a frente inclui, quando for desenhada e construída** (nada disto está decidido em detalhe ainda):
- Configuração do lojista: habilita ou não; condições (prazo pra cancelar, quais status do pedido permitem, automático vs. exige aprovação do vendedor).
- Ação disponível na área do cliente ("Meus Pedidos", §18.2).
- Tratamento de estoque (devolver saldo, mesmo mecanismo de §17.1).
- Notificação ao lojista quando o cliente cancela — conecta com a melhoria de notificação de §18.6(c) (mesmo destinatário/mecanismo: staff escolhidos, canal configurável), só um evento novo no mesmo pipeline.

Ver `ESCOPO_PROJETO.md` §4 "Roadmap e Frentes pós-Fase 2" pro registro desta frente no mapa geral.

---

## 18. Notificações e Área do Cliente (Fase 2)

**📐 Decidido com o PO em 18/08/2026.**

### 18.1 Quando o cliente é notificado

O cliente é notificado sempre que o pedido muda de estado por ação do vendedor ou do sistema: **validação** (aceito), **ajuste** (itens reduzidos/removidos — §15.4) e **cancelamento** (§17). A notificação avisa da novidade e direciona o cliente pra área do cliente (§18.2), que é onde ele vê o detalhe completo — a notificação em si é só o aviso, não o lugar de conferir os dados.

> **📌 Ampliado (03/09/2026) — a lista completa e atual dos eventos de notificação está no §18.7 (catálogo consolidado).** Além de validação/ajuste/cancelamento, o cliente também é notificado ao **finalizar o checkout** (`pedido_recebido`), ao pedido ser **concluído/entregue** (`pedido_entregue`) e ao ter a **data de entrega remarcada** (`pedido_data_remarcada`). O §18.7 é a referência de negócio; este §18.1 fica como o registro histórico da decisão original.

### 18.2 Área do cliente ("Meus Pedidos") — nasce no MVP

**✅ Implementado e testado com Chromium real contra a URL pública em 21/08/2026 — Fase 2, incremento 6 do roteiro.**

Cliente logado (§14) tem uma área própria pra ver os pedidos que fez, com o **estado final e atualizado** de cada um — itens, ajustes feitos pelo vendedor, total, status. É a **fonte de verdade** do acompanhamento do pedido: qualquer dúvida sobre "o que ficou combinado", a resposta está lá, sempre refletindo o estado mais recente (não uma cópia estática do momento da finalização).

**PDF do pedido não é o mecanismo principal** — fica como opção secundária/futura (útil pra imprimir ou guardar localmente, mas a área do cliente é o canal oficial de acompanhamento, sempre atualizado; um PDF gerado na finalização ficaria desatualizado assim que o vendedor ajustasse o pedido).

**Comportamento conhecido a resolver aqui, registrado em 20/08/2026 (achado do usuário, não é bug de rota)**: hoje o header da vitrine sempre mostra "Entrar" e não reflete se o cliente já está logado — depois de confirmar o cadastro pelo link de e-mail, o Supabase já cria sessão automaticamente (o app fica de fato autenticado), mas o header não sabe disso e continua oferecendo "Entrar" (que não leva a nada de novo, já que a sessão já existe). Isso acontece porque o header da vitrine foi construído antes de existir conta de cliente (Fase 1). Faz parte do escopo deste incremento: quando há sessão de cliente ativa, o header deve mostrar acesso à área do cliente ("Meus Pedidos"/nome) e a opção de sair; "Entrar" só aparece pra quem está deslogado.

**✅ Resolvido em 21/08/2026.** `HeaderContaMenu` (`src/components/loja/header-conta-menu.tsx`, dropdown via Base UI) mostra avatar com iniciais + primeiro nome + "Meus Pedidos"/"Minha Conta"/"Sair" quando há sessão de cliente ativa (`(loja)/layout.tsx` passa a chamar `getCustomerProfile()` uma vez, repassado pro `Header`); "Entrar" segue exatamente como antes pra quem está deslogado.

**Telas implementadas**: `/meus-pedidos` (lista — número, data, status em português, cidade, total) e `/meus-pedidos/[numero]` (detalhe — itens com nome/variação/quantidade/preço, cidade + ponto de encontro + horário, datas prevista/efetiva só quando preenchidas, observação do cliente, total). Leitura via client **servidor** direto (não RPC, não Route Handler) — a RLS `orders_select_own`/`order_items_select_own` (migration 037) já garante que o cliente só vê os próprios pedidos, reforçado por um filtro explícito por `customer_id` na query (defesa em profundidade, mesmo padrão já usado em `criar_pedido`). **A query do detalhe nunca seleciona `observacao_interna`** — não é uma coluna escondida na tela, é uma coluna que o `SELECT` nem pede ao banco, confirmado com Chromium inspecionando o HTML bruto da resposta (não só a tela renderizada).

**✅ Verificado em 26/08/2026 (dúvida levantada pelo PO ao revisar o link das notificações do incremento 8, §18.5) — link de notificação → login → retorno ao pedido já funciona de ponta a ponta, nenhuma correção necessária.** Hipótese checada: um cliente deslogado clicando no link do e-mail/WhatsApp (`https://{domínio}/meus-pedidos/{numero}`, sem `?proximo=` embutido) cairia na vitrine em vez de voltar pro pedido após logar. **Não procede** — `/meus-pedidos/[numero]/page.tsx:24` já faz `redirect(\`/entrar?proximo=/meus-pedidos/${numero}\`)` sozinho quando detecta ausência de sessão (mesmo padrão de auto-guarda de `/painel/**`, não depende de `proxy.ts`/`ROTAS_PROTEGIDAS` — que nem lista `/meus-pedidos`, e não precisa listar); `/entrar` lê `?proximo=` da URL e embute num campo oculto do formulário; `/api/auth/login` redireciona pra esse `proximo` após o login. Cadeia completa lida e confirmada, não presumida. Link de notificação não precisa (e não deve) embutir `?proximo=` manualmente — a página de destino já resolve isso sozinha.

### 18.3 Canais de notificação: e-mail + WhatsApp, dois níveis de WhatsApp

**E-mail** e a **área do cliente** (§18.2) entram no MVP como canais/registro padrão.

**WhatsApp em dois níveis, faseados**:

| Nível | O que é | Integração | Fase |
|---|---|---|---|
| **1 — Saída** | O sistema avisa o cliente (confirmação, validação, ajuste, cancelamento) — mensagem parte do sistema, cliente só recebe | **Evolution API** (já cogitada na visão original do produto) | **MVP** |
| **2 — Entrada** | Cliente manda mensagem perguntando sobre o pedido e o sistema responde — atendimento conversacional | **N8N** | **Fase seguinte** (não MVP) |

A arquitetura de notificação nasce pensada pra múltiplos canais desde o início (e-mail + WhatsApp de saída juntos no MVP), com o conversacional (N8N, Nível 2) como incremento posterior — não uma reescrita.

### 18.4 Área do cliente — editar dados cadastrais e trocar senha

**📐 Decidido com o PO em 18/08/2026, complementa §18.2. ✅ Implementado e testado com Chromium real contra a URL pública em 21/08/2026.**

Além de "Meus Pedidos" (§18.2), a área do cliente no MVP inclui:

- **Editar dados cadastrais**: nome, telefone, e-mail, cidade de entrega padrão.
- **Trocar senha**.

**Revisão na implementação (21/08/2026): e-mail ficou de fora do formulário, de propósito.** É o identificador de login gerenciado pelo Supabase Auth — permitir editar aqui exigiria um fluxo de confirmação próprio (parecido com o do cadastro, §14.1), fora de escopo deste incremento. Tela `/minha-conta` (`src/components/loja/conta/conta-form.tsx`) mostra o e-mail como informação read-only ("não pode ser alterado aqui") e só permite editar nome/WhatsApp/cidade de entrega.

**Defesa em profundidade no salvamento dos dados**: a policy `customers_update_own` (migration 013) só restringe **qual linha** o cliente pode mexer (`auth_user_id = auth.uid()`) — RLS do Postgres não restringe **quais colunas**, então tecnicamente o cliente poderia tentar sobrescrever `ativo`/`tenant_id`/`email` também. O Route Handler `PATCH /api/loja/conta` fecha isso com um schema zod fechado em só 3 campos (nome/whatsapp/delivery_city_id) — nunca repassa o corpo da requisição inteiro pro `.update()`. **Testado de verdade**: uma requisição real com `email`/`ativo`/`tenant_id` extras no payload confirmou que esses 3 campos continuam intocados no banco depois (só nome/whatsapp/cidade, os campos legítimos, mudaram).

**Bug real de produção encontrado e corrigido durante este incremento: `/nova-senha` (recuperação de senha) estava quebrada.** Ao generalizar a lição do checkout (incremento 5 — `supabase.rpc()` direto do browser client não enxerga sessão vinda de cookies httpOnly), testei se `supabase.auth.updateUser({password})` sofria do mesmo problema — e sim: logando um cliente via `/api/auth/login` (mesma forma que `/auth/callback` estabelece sessão após um link de recuperação) e tentando trocar a senha na tela `/nova-senha` já existente (código de produção, sem nenhuma mudança), a troca **sempre falhava** com "Não foi possível alterar a senha. O link pode ter expirado." — mesmo com sessão fresca, não expirada. Ou seja, **qualquer cliente que esquecesse a senha não conseguia recuperá-la**, silenciosamente, desde que essa tela existe. Corrigido com um Route Handler novo e genérico (`POST /api/auth/senha`, mora em `/api/auth` porque serve staff **ou** cliente, qualquer sessão autenticada — não é específico da vitrine) usando o client servidor; `/nova-senha` e a seção "Alterar senha" de `/minha-conta` usam essa mesma rota.

**Limite do teste de `/nova-senha` — mesma limitação de `generateLink()` já documentada no Bug 2**: `admin.generateLink({type:'recovery'})` também não reproduz o formato PKCE do link real de recuperação (mesmo achado da migration/incidente do Bug 2, confirmado de novo aqui) — não dá pra clicar num link 100% fiel sem uma caixa de e-mail de verdade. O que **foi** provado de ponta a ponta: um cliente com sessão estabelecida por uma rota servidor (exatamente o que `/auth/callback` faz depois de um link de recuperação real) consegue trocar a senha pela nova rota e **logar de novo com a senha nova** — a causa raiz do bug (browser client não enxerga cookies httpOnly) é a mesma independente de qual rota criou a sessão, então esse teste prova o mecanismo da correção. Recomendado ao usuário fazer uma checagem manual rápida do `/recuperar-senha` com e-mail real como confirmação final, mesmo padrão já usado pra fechar o Bug 2.

**✅ CONFIRMADO com link real pelo usuário, 21/08/2026.** Teste manual de ponta a ponta (e-mail → link real de recuperação → redefinir senha → login com a senha nova) funcionou corretamente. Com isso, o bug de produção da recuperação de senha está **fechado e validado com o link real**, não só pelo mecanismo equivalente testado antes — mesmo padrão de fechamento já usado no Bug 2 (`ESCOPO_PROJETO.md` §0 item 42).

### 18.5 Arquitetura de envio (item 5 da sequência pré-incremento 8) — desenhado e implementado em 25/08/2026

**📐 Desenho aprovado com o PO em 25/08/2026, antes de qualquer código.** Cobre o envio de fato das notificações de §18.1 (validado/ajustado/cancelado) pelos dois canais de §18.3 (e-mail + WhatsApp Nível 1).

**Canal-agnóstico por desenho**: `NotificationChannel` (`src/lib/notificacoes/types.ts`) é a interface única — `notificar-pedido.ts` (orquestrador) não conhece Zoho nem Evolution API, só fala com a interface. Cada provedor concreto é uma implementação separada (`canal-email.ts`, `canal-whatsapp.ts`), trocável sem tocar em quem chama.

- **E-mail**: Zoho Mail via SMTP (`nodemailer`), primeira implementação concreta. Nomes de env var **genéricos** de propósito (`EMAIL_SMTP_*`, não `ZOHO_*`) — uma troca futura de provedor SMTP não exige renomear nada.
- **Débito conhecido, registrado como roadmap, não implementado agora**: Zoho Mail SMTP tem limite diário baixo, não é feito pra volume transacional — a própria Zoho recomenda **ZeptoMail** (API própria, mesmo grupo) pra esse caso de uso. Zoho SMTP serve pra validar o fluxo agora; ZeptoMail vira uma segunda implementação de `NotificationChannel` quando o volume justificar — troca de adapter, não reescrita.
- **WhatsApp**: Evolution API (instância já provisionada pela VLUMA, `https://evo.vluma.com.br`), Nível 1 (saída) — `fetch` puro contra `POST {url}/message/sendText/{instance}`, sem lib nova. `customers.whatsapp` é gravado só com DDD+número (sem DDI, ver §14.3/cadastro) — o canal prefixa `55` antes de enviar, premissa a confirmar no primeiro envio real.
- **Credenciais**: só env var (secrets no Vercel/GitHub), nunca em arquivo/banco. Um painel de gestão de provedores/credenciais por tenant fica pra fase futura — a arquitetura (interface + templates por tenant, ver abaixo) já nasce pronta pra receber isso, mas a tela **não é construída agora**.

**Templates em dados, não em código** (decisão de produto do PO): tabela nova `notification_templates` (por tenant — migration `043`), 3 eventos × 2 canais, com placeholders (`{nome_cliente}`, `{numero_pedido}`, `{nome_loja}`, `{link_pedido}`, `{motivo}` — só cancelamento) resolvidos em `src/lib/notificacoes/templates.ts`. RLS staff-select/admin-write (mesmo padrão de `store_settings`) já pronta pra uma tela de edição futura, **não construída agora** — hoje os textos só são editáveis por SQL direto.

**📌 Regra de redação de template — grafia de `{nome_loja}` (insert-only, 01/09/2026, migration `046`):** templates de notificação **nunca** usam preposição+artigo antes de `{nome_loja}` (`na` / `no` / `em` — ex.: "na {nome_loja}", "no {nome_loja}"). `{nome_loja}` é resolvido por tenant no envio e o gênero do nome varia (masculino/feminino) — uma preposição+artigo fixa quebra a concordância pra parte dos tenants no SaaS. O branding é preservado por uma **assinatura final** `— Equipe {nome_loja}` (ou pelo nome isolado, sem preposição, quando cabe na frase). Correção aplicada em 01/09/2026 a todos os eventos/canais já existentes (lojista + cliente) via migration `046`. **Vale para os incrementos 2–4 da frente de notificações ao cliente (`ESCOPO_PROJETO.md` §0 item 52) e qualquer template futuro.**

**Onde o envio é disparado**: nos Route Handlers do painel de Pedidos (`/validar`, `/editar`, `/cancelar`), depois do RPC ter sucesso — nunca dentro da RPC (Postgres não tem como chamar API HTTP externa neste projeto). Usa `after()` (Next.js) pra não atrasar a resposta que o vendedor vê — a notificação roda depois da resposta ser enviada, mas antes da função serverless ser encerrada. Falha de envio **nunca** desfaz nem bloqueia a ação do vendedor (mesmo princípio já usado no e-mail de "definir senha" da Equipe, §22) — só loga no console do servidor (best-effort; há staff olhando a tela nesses caminhos).

**Gap de arquitetura fechado — cancelamento automático (cron) também notifica.** `cancelar_pedidos_expirados()` (migration `039`) rodava sem sessão via GitHub Action, chamando a RPC direto via REST com a `anon key`, e só devolvia a **quantidade** cancelada — sem saber *quais* pedidos, não havia como notificar esses clientes. Migration `042`: a RPC passa a devolver os pedidos afetados (id/tenant_id/customer_id/numero) via `RETURNING`. **Decisão de segurança tomada ao desenhar a migration**: devolver esses dados não pode mais ser aberto a `anon`/`authenticated` (viraria enumeração de pedidos/clientes de qualquer tenant pra quem tiver a anon key, pública por design) — revogado desses papéis, concedido só a `service_role` (mesmo padrão estrutural de `promover_para_staff`, migration `041`). O GitHub Action deixa de chamar a RPC direto e passa a chamar uma rota nova (`POST /api/cron/notificar-cancelamentos`, autenticada por um segredo compartilhado `CRON_SECRET`, não por login) que usa o client de service role internamente, recebe a lista de pedidos cancelados e notifica cada um.

**Observabilidade do caminho automático (pedido do PO)**: como não há staff olhando o cron rodar, best-effort/console não é suficiente — `POST /api/cron/notificar-cancelamentos` devolve um **resumo no corpo da resposta** (quantos pedidos cancelados, quantos envios OK/falha por canal, detalhe por pedido), e o workflow do GitHub Actions imprime essa resposta no log da run. Sem tabela de log nova neste incremento (superdimensionaria) — o log da Action é a observabilidade deste caminho.

**Env vars novas a cadastrar** (nomes exatos, nenhum valor nos docs — secrets no Vercel/GitHub):
`EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_SECURE`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD` (app password do Zoho, nunca a senha da conta — 2FA ativo), `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `CRON_SECRET` (novo). `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE` já estavam reservadas desde o `.env.example` original — só faltavam os valores. No GitHub Actions: `APP_URL` (novo, URL pública do deploy) + `CRON_SECRET`.

**📌 Credenciais atuais são de TESTE, não as reais do Cauã — troca antes de produção fica registrada como pendência formal em `ESCOPO_PROJETO.md` §1 "Checklist de pré-produção do Cauã", item 1.** Não esquecer quando o Cauã for pra produção de verdade.

**📌 Regra de dado de teste ao disparar notificação (02/09/2026):** contas de teste que possam disparar e-mail/WhatsApp só usam os destinatários reais do PO (`sergiodorea1975@gmail.com` / `71991215016`) ou deixam o campo vazio — **nunca** valor fabricado. Regra completa + evidência (pedido de teste #43: WhatsApp fabricado colidiu com a linha da instância Evolution → auto-envio) em §0.1.

**Visão de SaaS aplicada aqui, mesmo o Cauã sendo single-tenant hoje**: a interface `NotificationChannel` (canal-agnóstica) já desacopla o pipeline de notificação de onde a credencial mora — hoje env var global, no SaaS vira config por-tenant (`ESCOPO_PROJETO.md` §1, pilar 5 "Autonomia de configuração do lojista") — sem precisar reescrever `notificar-pedido.ts`/`canal-email.ts`/`canal-whatsapp.ts`, só trocar de onde a credencial é lida.

Ver `ESCOPO_PROJETO.md` §0 item 49/50 (item 5 da sequência) pro estado de implementação/teste.

**✅ Testado ponta a ponta em 26/08/2026, com recebimento real confirmado nos dois canais (e-mail e WhatsApp, número real do PO) — incremento 8 fechado.** Detalhe completo do teste em `ESCOPO_PROJETO.md` §0 item 49/50. Com isso, a **Fase 2 (Carrinho/Checkout/Pedidos/Notificações) está 100% completa**.

### 18.6 Duas melhorias de notificação — aprovadas pelo PO como próximo incremento, NÃO implementadas ainda

**📌 Registradas com o PO em 26/08/2026, logo após o incremento 8 fechar — reaproveitam o mesmo pipeline (`NotificationChannel`, `notificar-pedido.ts`, templates em dados), só novos gatilhos + novos templates. Curto de implementar, mas não começar sem autorização explícita — mesma regra de sempre.**

**(c) — PRIORIDADE MAIOR: notificar o VENDEDOR (Cauã) quando entra um pedido novo.** Hoje o vendedor só descobre um pedido novo abrindo o painel manualmente — sem isso, um pedido pode ficar horas esperando validação sem o lojista saber, impacto operacional real (é exatamente o tipo de solicitação perdida que o cancelamento automático de 48h, §17.2, existe pra não deixar acumular silenciosamente, mas 48h é tempo demais pra um lojista que quer atender rápido). Ainda a definir antes de implementar:
- **Gatilho**: mais provável é depois de `criar_pedido` ter sucesso, no Route Handler de checkout — a confirmar quando for desenhado.
- **Destinatário**: **não é o cliente** — é o contato do **tenant** (telefone/e-mail do Cauã), não gravado em `customers`. Hoje seria env var (mesmo padrão de `EMAIL_FROM_ADDRESS`/`EVOLUTION_INSTANCE`); no SaaS vira contato configurável por-tenant — mesmo princípio já registrado em `ESCOPO_PROJETO.md` §1 (visão SaaS mesmo em single-tenant).
- Novo evento (`pedido_novo` ou nome a definir) + 2 templates novos (e-mail + WhatsApp, tom voltado pro lojista, não pro cliente).

**Decisões de produto detalhadas com o PO em 26/08/2026 — revisam/substituem a suposição de "destinatário = env var" registrada acima:**
- **Destinatários escolhidos entre os STAFF cadastrados** (`profiles`), não um número/e-mail avulso — o admin escolhe quais membros da equipe recebem. Nunca um contato gravado fora do cadastro de equipe já existente (`/painel/equipe`, §22).
- **Canal configurável por destinatário**: cada staff escolhido recebe por WhatsApp, e-mail, ou os dois — não é um canal único pra todo mundo.
- **Permissão de configurar**: só **admin** (mesmo padrão de `/painel/equipe` e do módulo de Configuração, §22/item 4 da sequência pré-incremento 8) — operador não configura quem recebe.
- **Exige tela de configuração própria** (autonomia do lojista/self-service) — sem tela, vira dependência de suporte da VLUMA pra ligar/desligar destinatário, contradizendo o princípio de self-service já registrado em `ESCOPO_PROJETO.md` §1.
- **Distinção clara de propósito**: esta notificação é pro **lojista** (staff) saber que chegou um pedido — **diferente** das notificações ao **cliente** (§18.1, já construídas, vão pro contato do próprio cliente). Os dois pipelines reaproveitam o mesmo `NotificationChannel`/`notificar-pedido.ts`, mas nunca se misturam (destinatários diferentes, tabela diferente de onde vem o destinatário).
- **Escopo do MVP desta melhoria**: só o evento "pedido novo". O evento "cancelamento pelo cliente" (§17.3, ainda não construído) entra na mesma tela/mecanismo **quando** aquela frente for construída — não há granularidade de escolher eventos individualmente no MVP desta melhoria (é tudo-ou-nada por destinatário, não por evento).

**(b) — confirmar ao CLIENTE que o pedido foi RECEBIDO, no momento em que ele finaliza o checkout** (antes de qualquer validação do vendedor) — "recebemos seu pedido, em breve confirmaremos". Dá segurança imediata ao cliente. Menos crítico que (c): o cliente já vê o pedido em "Meus Pedidos" assim que finaliza, isto é só reforço de UX, não corrige uma lacuna operacional real como (c).
- Gatilho: mesmo ponto de (c) — depois de `criar_pedido` ter sucesso.
- Novo evento (`pedido_recebido` ou nome a definir) + 2 templates novos (e-mail + WhatsApp, pro cliente desta vez).

Ambos ficam **registrados como próximo incremento, não implementados agora** — desenho completo (nome exato dos eventos, textos-base, ponto exato do gatilho) fica pra quando o PO autorizar o início, seguindo o mesmo método já em vigor: desenho apresentado e aprovado antes de codar.

**📌 Atualização de estado, 01/09/2026 (insert-only, prevalece sobre o "NÃO implementadas" acima quanto ao item (c)):** a melhoria (c) — aviso de pedido novo ao lojista — **foi implementada** (migration `044` + estrutura, campo WhatsApp opcional no cadastro de staff, tela `/painel/configuracoes › Notificações`, gatilho + orquestrador; robustez de SMTP com timeouts + `maxDuration` no checkout). **Ainda em teste, PENDENTE:** (GRUPO B) confirmar recebimento real dos e-mails de teste ao lojista + confirmar destinatários cadastrados na tela (`order_notification_recipients` estava vazia) + corrigir o canal de e-mail (suspeita: throttle do Zoho / timeouts); (GRUPO C) confirmar identidade de remetente da instância Evolution — aguardando o número da instância do usuário. Detalhe e rastreamento em `ESCOPO_PROJETO.md` §0 item 51. A melhoria (b) segue não implementada.

**📌 Atualização de estado, 01/09/2026 (insert-only, prevalece sobre o "NÃO implementadas" acima quanto ao item (b)):** a melhoria (b) — confirmação ao CLIENTE de "pedido recebido" — passou a ser tratada como **frente de 4 eventos ao cliente, incrementais, um por vez** (`pedido_recebido` → `pedido_aprovado` → `pedido_entregue` → `pedido_cancelado`). **Incremento 1 de 4 (`pedido_recebido`) implementado**: migration `045` (evento novo em `notification_templates` + seed dos 2 textos aprovados pelo PO), 2º `after()` no `POST /api/loja/checkout` chamando `notificarPedido(..., 'pedido_recebido')` ao lado do aviso ao lojista (pipelines independentes, sem cruzamento), guard `if (cliente.whatsapp)` no orquestrador do cliente. Gatilho = após `criar_pedido` ter sucesso no checkout (o mesmo ponto de (c), os dois disparos convivem). Mapa completo dos 4 eventos, pontos de disparo e a decisão de produto adiada para o incremento 4 (template único vs. por motivo no `pedido_cancelado`) em `ESCOPO_PROJETO.md` §0 item 52. Incrementos 2–4 não iniciados.

**📌 Incremento 2 (`pedido_validado`) — implementado 01/09/2026, e decisão de design sobre notificações de ajuste vs. validação (insert-only):** o cliente passa a ser notificado quando o vendedor **valida** o pedido, via o `after()` que já existia em `POST /api/painel/pedidos/[id]/validar` desde o incremento 8 (evento `pedido_validado`, `.catch()` próprio, não afeta a resposta ao vendedor). **Nenhum código novo** — o evento, o `after()`, os tipos e o template já existiam; só se confirmou que está tudo plugado. **Decisão do PO (01/09/2026): ajuste e validação são notificações INDEPENDENTES por design.** O evento `pedido_ajustado` já dispara desde o incremento 8 a partir de `POST /api/painel/pedidos/[id]/editar` (`ajustar_itens_pedido`, §15.4) quando o vendedor reduz/remove item antes de validar. Se ajuste e validação acontecem no mesmo pedido, o cliente recebe **as duas** mensagens (`pedido_ajustado` ao salvar a edição + `pedido_validado` ao validar) — comportamento **correto**, são dois eventos reais e distintos, não duplicação. O `/editar` (RPC `ajustar_itens_pedido`, componente `pedido-itens-section.tsx` e seu texto de UI) **não é tocado**. Descartadas as alternativas de "notificação única na validação" (flag no client ou coluna `orders.foi_ajustado`) — investigadas em 01/09/2026 e recusadas pelo PO. Recebimento real dos 2 canais fica pro **teste integrado final** dos 4 incrementos, pelo PO.

**📌 Incremento 3 (`pedido_entregue`) — implementado 02/09/2026 (insert-only):** o cliente passa a ser notificado quando o vendedor **conclui** o pedido (marca a entrega como realizada, `confirmado → concluido`). Gatilho: `after()` **novo** em `POST /api/painel/pedidos/[id]/concluir` (não existia — diferente do incremento 2), chamando `notificarPedido(perfil.tenant_id, id, 'pedido_entregue')` após o guard de erro, `.catch()` próprio, sem afetar a resposta ao vendedor. Migration `047` (CHECK + seed dos 2 textos, aplicada pelo PO). `pedido_entregue` += nos tipos (`types.ts`, `database.ts`). `templates.ts`/`notificar-pedido.ts`/`concluir_pedido` não tocados. Recebimento real: **teste integrado final** dos 4 incrementos, pelo PO.

**📌 Feature "notificar quando o vendedor modifica o pedido" — Incremento (A): previsão de entrega no `pedido_validado` — implementado 02/09/2026 (insert-only).** O texto do `pedido_validado` (email + whatsapp) passa a incluir "Previsão de entrega: {data_prevista}." (migration `048`, aplicada pelo PO). **Decisão de produto: a regra de fallback do placeholder `{data_prevista}` vive na RESOLUÇÃO (orquestrador `notificar-pedido.ts`), não no texto do template** — `data_prevista` preenchida resolve para `dd/mm/aaaa`, vazia/null resolve para o literal **`"a combinar"`**. Motivo: o placeholder tem que resolver sempre para algo válido mesmo que o lojista edite o texto do template no futuro (visão SaaS — templates viram editáveis por-tenant). A chave `data_prevista` fica sempre presente no `vars` (como `motivo`), disponível para qualquer template. Nenhum outro evento muda; sem tela. **Incremento (B) — remarcação de `data_prevista` depois da validação — IMPLEMENTADO 03/09/2026. Fecha a feature "modificação de pedido pelo vendedor" (A + B).** Regras de negócio: remarcar só em `aguardando_validacao`/`confirmado` (nunca `concluido`/`cancelado`); diálogo "Remarcar entrega" (nova data + motivo); evento **específico `pedido_data_remarcada`** (texto ao cliente mostra a nova data via `{data_prevista}`); **motivo obrigatório e interno** — o cliente NUNCA vê o motivo da remarcação; a RPC `remarcar_entrega_pedido` rejeita data no passado, data igual à atual, e motivo vazio; toda remarcação bem-sucedida grava uma linha imutável em `order_delivery_reschedules` (histórico/rastreabilidade — visão SaaS; RLS só-select para staff do tenant, cliente nunca acessa) e atualiza `orders.data_prevista`, na mesma transação. Notifica-se **sempre** numa remarcação bem-sucedida, inclusive quando não havia previsão anterior. Migrations `049`/`050`/`051` aplicadas pelo PO; código (handler `/remarcar-entrega`, diálogo, hook, tipos) e teste de painel na HML em `ESCOPO_PROJETO.md` §0 item 52. Recebimento real da notificação: teste e2e do PO.

### 18.7 Catálogo consolidado de notificações — referência de negócio (insert-only, 03/09/2026)

**✅ Em vigor.** Consolida em linguagem de negócio o que os §§18.1–18.6 e as atualizações incrementais acima descrevem de forma dispersa. Nada aqui substitui aqueles blocos — é a leitura de referência (base do manual do usuário).

#### Notificações ao CLIENTE (ciclo do pedido)

Todas vão pelos **dois canais**: e-mail **e** WhatsApp. Se o cliente não tiver um dos contatos preenchido, o canal correspondente é simplesmente pulado (sem erro). Toda mensagem direciona o cliente à área "Meus Pedidos" (§18.2), que é a fonte de verdade do detalhe.

| Evento | Quando dispara | O que a mensagem diz |
|---|---|---|
| **Pedido recebido** | O cliente finaliza o checkout | "Recebemos seu pedido #N, em breve confirmaremos os detalhes." Aviso de que o pedido entrou — ainda não foi validado pelo vendedor. |
| **Pedido validado** | O vendedor valida (aceita) o pedido | "Seu pedido #N foi confirmado e já está sendo preparado. Previsão de entrega: {data}." Inclui **a previsão de entrega** — quando o vendedor não informou data, aparece **"a combinar"**. |
| **Pedido ajustado** | O vendedor reduz/remove itens ao editar o pedido (§15.4) | "Um ou mais itens foram reduzidos ou removidos por falta de estoque. Confira o que mudou." Direciona ao link do pedido — o detalhe item a item fica na área do cliente, não no texto. |
| **Pedido entregue** | O vendedor conclui o pedido (marca a entrega como realizada) | "Seu pedido #N foi entregue. Obrigado pela preferência." |
| **Data de entrega remarcada** | O vendedor remarca a data prevista de entrega | "A previsão de entrega do seu pedido #N foi atualizada para {nova data}." **O motivo da remarcação é interno e nunca aparece para o cliente.** |
| **Pedido cancelado** | O vendedor cancela manualmente (§17.1) **ou** o cancelamento automático por tempo (§17.2) dispara | "Seu pedido #N foi cancelado. Motivo: {motivo}." No cancelamento manual, o motivo é o texto que o vendedor digitou; no automático, é um texto padrão do sistema ("Cancelamento automático — prazo de validação expirado"). |

**Regra: ajuste e validação são notificações independentes por design.** Se o vendedor edita o pedido (reduz itens) e depois valida, o cliente recebe **as duas** mensagens — "pedido ajustado" ao salvar a edição e "pedido validado" ao validar. São dois fatos reais e distintos; não é duplicação.

**Regra: motivo de cancelamento vs. motivo de remarcação — tratamento oposto, e proposital.** O **motivo de cancelamento** é **comunicado ao cliente** na notificação (ele precisa saber por que o pedido foi cancelado). O **motivo de remarcação de entrega** é de **uso interno** e **nunca aparece na notificação ao cliente** — nesta, o cliente vê apenas a **nova data prevista**. Os dois comportamentos estão corretos como implementados e devem permanecer assim.

#### Notificação ao LOJISTA (equipe)

| Evento | Quando dispara | Destinatário |
|---|---|---|
| **Pedido novo** | O cliente finaliza o checkout | Os membros da equipe **cadastrados como destinatários** em `/painel/configuracoes › Notificações`, cada um pelos canais que escolheu (e-mail, WhatsApp, ou os dois). |

**Se nenhum destinatário estiver cadastrado, nada é enviado — e isso é o comportamento correto, não uma falha.** O aviso ao lojista é sempre separado do aviso ao cliente (destinatário diferente, evento diferente); nunca se misturam.

#### Regras de redação dos textos de notificação (templates)

Os textos ficam guardados como **dados** (editáveis por loja no futuro), não no código. Ao escrever ou editar um template:

- **Nunca usar preposição+artigo (na / no / em) antes de `{nome_loja}`.** O nome da loja varia de gênero de uma loja para outra (fase SaaS) — "na Criatório..." fica errado. O branding entra pela **assinatura final "— Equipe {nome_loja}"** ou pelo nome isolado, sem preposição.
- **`{data_prevista}` é resolvido no momento do envio** — vira `dd/mm/aaaa` quando há data, ou o literal **"a combinar"** quando não há. Essa regra de preenchimento vive na **resolução** (no sistema), não no texto do template — assim o texto continua correto mesmo que o lojista edite o template mais tarde.
- **Placeholders disponíveis:** `{nome_cliente}`, `{numero_pedido}`, `{nome_loja}`, `{link_pedido}`, `{data_prevista}`, `{motivo}`.

---

## 19. Status e ciclo de vida do pedido (Fase 2)

**📐 Decidido com o PO em 18/08/2026.**

### 19.1 Quatro status genéricos, válidos pra qualquer modalidade de entrega

O pedido tem quatro status possíveis:

| Status | Significa |
|---|---|
| **Aguardando validação** | Pedido finalizado pelo cliente, ainda não conferido pelo vendedor (estado inicial, Fluxo A — §15.3) |
| **Confirmado** | Vendedor validou (§15.4) — pedido atende, aguardando a entrega |
| **Concluído** | Entrega realizada |
| **Cancelado** | Terminal — alcançável a partir de qualquer um dos três acima (§17) |

Modalidade de entrega (§5) e as datas (§19.2) são **campos** do pedido, não geram status próprio — evita ter que criar um status por modalidade quando Correios/transportadora/frete calculado entrarem no futuro; os quatro status acima continuam servindo sem mudança.

### 19.2 Datas de entrega — campos simples no MVP

- **`data_prevista`**: orienta cliente e vendedor sobre quando a entrega deve acontecer, antes de acontecer.
- **`data_efetiva`**: "entregue em" — preenchida no momento em que o pedido vira **Concluído**, registro histórico do que de fato ocorreu.

No MVP os dois são campos simples — sem lembrete automático, sem cálculo de janela de entrega. Fica pra refinamento futuro.

### 19.3 Observações — cliente e interna, nunca a mesma caixa

- **`observacao_cliente`**: recado que o próprio cliente escreve no checkout (ex.: "entregar depois das 18h").
- **`observacao_interna`**: anotação do vendedor sobre o pedido — o cliente **nunca** vê esse campo, é uso interno da equipe.

---

## 20. Tela de validação do pedido (painel do vendedor)

**📐 Decidido com o PO em 18/08/2026, detalha a operação de "Validar" do Fluxo A (§15.3/§15.4). ✅ Implementado e testado com Chromium real contra a URL pública em 21/08/2026 — Fase 2, incremento 7, parte 3 do roteiro.**

**Telas**: `/painel/pedidos` (listagem, filtro por status — os 4 + "Todos" — número/cliente/data/cidade/status/total, mais recente primeiro) e `/painel/pedidos/[id]` (detalhe/validação, conteúdo abaixo). Padrão de Route Handler + React Query do resto do painel (como `/painel/produtos`); escritas sempre via Route Handler com o client servidor chamando as RPCs da migration `039` (mesma lição do checkout/`/nova-senha` — sessão httpOnly não é visível ao client do navegador).

**Teste completo (Chromium real, `ecommercecauahml.vluma.com.br`, cliente de teste + 3 pedidos reais criados via checkout de verdade + sessão real de staff admin)**: (a) listagem com os 4 filtros de status + "Todos" confirmados, rótulos em português corretos; (b) detalhe mostrando cliente (nome/e-mail/WhatsApp com atalho `wa.me` funcionando), entrega (cidade/ponto de encontro/horário), itens com estoque disponível ao lado de cada um, total, observação do cliente; (c) **observação interna confirmada NUNCA vazando pra área do cliente** — testado colocando um texto-marcador em `observacao_interna` via banco e conferindo o HTML bruto de `/meus-pedidos` e `/meus-pedidos/[numero]`, o marcador não aparece em nenhum dos dois; (d) as 4 ações ponta a ponta pela tela: Editar reduziu um item de 6→3 e recalculou o total corretamente (nunca permitiu aumentar), Validar baixou o estoque de verdade (confirmado no banco: saldo e `stock_movements` com `referencia_tipo='pedido'`), Cancelar antes da validação não gerou nenhuma movimentação de estoque (nunca reservou nada) enquanto Cancelar depois de validado devolveu o estoque exatamente na mesma quantidade baixada, Concluir gravou `data_efetiva`; (e) ações respeitando status — Validar só aparece em `aguardando_validacao`, Concluir só em `confirmado`, Cancelar em `aguardando_validacao`/`confirmado`, nunca em pedido terminal. **Gate de permissão (`pode_gerenciar`) confirmado só a nível de código nesta sessão** (RPC `staff_pode_gerenciar_pedidos` já testada com sessão real sem permissão na migration `039`/item 45; a tela em si não foi testada ao vivo com uma segunda conta de staff sem `pode_aceitar_pedido` nesta sessão — fica como pendência de teste, não de implementação). Zero resíduo de teste no banco ao final (estoque revertido via ajuste real de staff, 3 pedidos + cliente de teste removidos).

**Achado durante a implementação, corrigido na mesma sessão**: as mutations (Validar/Editar/Cancelar/Concluir) só invalidavam o cache do React Query, sem aplicar o retorno da própria RPC — o toast de sucesso aparecia mas a tela levava um round-trip extra pra trocar o status/as ações disponíveis na tela (confirmado que o backend já estava certo — um reload puro já mostrava o estado certo). Corrigido aplicando a linha de `orders` que as RPCs já devolvem direto no cache antes do invalidate — a tela agora reage no mesmo instante do toast, sem reload.

**Achado durante a implementação, migration nova criada (`040`) — ✅ aplicada pelo usuário e testada com Chromium real em 21/08/2026.** A `039` não trouxe nenhuma RPC de escrita pra `observacao_interna` (só a coluna, só leitura pro staff) — o campo "Observação interna", editável pelo vendedor, precisava da RPC `atualizar_observacao_interna_pedido` (migration `040`) pra persistir. **Teste completo depois de aplicada**: staff salva uma anotação pela tela (toast de sucesso), o valor persiste depois de um reload de página **e** foi confirmado gravado no banco; confirmado (de novo, com a RPC agora em uso de verdade, não só um valor colocado manualmente pra teste) que o HTML bruto de `/meus-pedidos`/`/meus-pedidos/[numero]` nunca contém o texto da observação interna. Zero resíduo de teste ao final.

**Ajuste de UX, achado pelo usuário no teste manual completo (24/08/2026) — ✅ implementado e testado com Chromium real no mesmo dia.** Faltava uma forma clara de voltar à listagem a partir do rodapé de `/painel/pedidos/[id]` — só existia o link pequeno no topo (breadcrumb-style). Adicionado botão "Voltar para pedidos" (`variant="outline"`) na mesma linha das ações de destino (Validar/Editar/Cancelar/Concluir), sempre visível — inclusive em pedido **terminal** (concluído/cancelado) ou quando o staff não tem `pode_aceitar_pedido`, casos em que antes a linha de ações não renderizava **nada** (`PedidoAcoes` retornava `null`), deixando o rodapé da tela vazio sem nenhum caminho de volta. Testado nos dois cenários: pedido ativo (com ações) e pedido concluído (sem nenhuma ação de destino) — botão presente e funcional nos dois, navega de volta pra `/painel/pedidos`. Zero resíduo de teste ao final.

A tela mostra, num só lugar:

- **Cliente**: nome, telefone/WhatsApp, e-mail.
- **Entrega**: modalidade + cidade/ponto de encontro escolhido (§5).
- **Itens**: produto, variação, quantidade, preço, com o **estoque disponível** exibido ao lado de cada item (referência pro vendedor decidir se reduz/remove — §15.4).
- **Total** do pedido.

Três ações: **Validar** (confirma o pedido como está), **Editar** (reduzir quantidade ou remover item — nunca aumentar nem adicionar, já decidido em §15.4) e **Cancelar** (exige motivo — §17.1). Ao editar, o **novo total é recalculado e mostrado na hora**, com aviso explícito de que o cliente será notificado da mudança (§18.1).

**Fora do escopo desta tela por enquanto**: histórico do cliente (quantos pedidos já fez, etc.) — é dado individual, natureza do módulo de Clientes (Fase 3, ainda não iniciado), não da tela de validação nem de Relatórios (camada agregada/analítica, outra fase). Quando o módulo de Clientes existir, a tela de validação pode passar a mostrar esse histórico como contexto — não decidido ainda.

---

## 21. Autogestão de conta — cliente e staff (Fase 2)

**📐 Decidido com o PO em 18/08/2026.**

Assim como o cliente pode editar os próprios dados e trocar senha na vitrine (§18.4), o **staff** ganha o mesmo no painel, no MVP: editar os próprios dados cadastrais e trocar senha.

Vale o mesmo princípio de isolamento de papéis já crítico no sistema (§1, reforçado em §14): a autogestão de conta de cada lado nunca cruza — cliente segue sem acesso ao painel, staff segue sem aparecer como cliente na vitrine, mesmo tendo os dois agora uma tela de "minha conta" equivalente.

---

## 22. Gestão de equipe (painel) — item 3 da sequência pré-incremento 8

**📐 Decidido com o PO em 24/08/2026, desenho aprovado antes de implementar. ✅ Implementado e testado com Chromium real contra a URL pública, sessão real de admin, no mesmo dia.**

Tela `/painel/equipe` (só STAFF — clientes ficam 100% pra Fase 3, módulo de Clientes completo com ficha/histórico) — consome pela primeira vez o fluxo de 2 passos que corrigiu o bug 46 (§2 "Padrão de autenticação", migration `041`).

**Escopo**: listar (filtro Ativos/Inativos/Todos), criar, editar (nome/papel/`pode_aceitar_pedido`), desativar/reativar, reenviar link de senha. Criar/editar/desativar são **ação de admin**, não de qualquer staff — diferente de `pode_aceitar_pedido` (que é sobre gerenciar *pedidos*, §15.4, não sobre gerenciar *a equipe*). E-mail não é editável no MVP (identificador de login ligado a `auth.users`, mudar exigiria coordenar com a Auth API — decisão deliberada de campo imutável, mesmo padrão do Código do Produto).

**Senha inicial do novo staff**: nunca é definida por ninguém (nem admin, nem sistema exibindo). `POST /api/painel/equipe` gera uma senha aleatória que não é vista/logada em lugar nenhum e imediatamente dispara `resetPasswordForEmail()` — **o mesmo mecanismo de recuperação de senha já testado com link real** (§18.4), não um convite novo. O novo membro recebe um e-mail de verdade e define a própria senha. Se o e-mail se perder, "Reenviar link" (ação de linha) dispara o mesmo mecanismo de novo.

**Autoproteção**: um admin não pode desativar a própria conta nem trocar o próprio papel (os dois via `id !== sessão atual` no Route Handler) — evita se trancar fora sozinho. Refinamento registrado pra o futuro, não implementado agora: uma regra "sempre ≥1 admin ativo" no sistema.

**Segurança**: `src/lib/supabase/admin.ts` (client com a service role key) só existe pra este fluxo — `import 'server-only'` no topo quebra o **build** se qualquer componente client tentar importá-lo, mesmo transitivamente (confirmado com um teste real: um componente client importando o helper derrubou o build do Next com o erro exato de `server-only`, removido em seguida). Duas camadas: o Route Handler confere `role === 'admin'` da sessão real antes de tudo; a RPC `promover_para_staff` continua `service_role`-only por baixo (mesma garantia estrutural da migration `041`) — mesmo que a primeira camada tivesse um bug, a segunda segura sozinha.

**Teste completo (Chromium real, sessão de admin real)**: staff novo criado ponta a ponta pela tela (toast confirma o e-mail enviado, não caiu no fallback de "não conseguimos enviar"); confirmado no banco que saiu de `customers` e entrou em `profiles` com papel/e-mail corretos; sessão do **operador recém-criado** tentando chamar `POST /api/painel/equipe` recebe 403 (gate admin-only funcionando de verdade, não só no código); admin tentando se autodesativar e tentando trocar o próprio papel — os dois recusados com mensagem clara, e o botão de desativar já vem desabilitado na própria linha na UI; edição de nome confirmada persistida no banco; desativar confirmado no banco. Zero resíduo de teste ao final.

---

## 23. Superfície de modificação de pedido pelo vendedor — consolidado (insert-only, 03/09/2026)

**✅ Em vigor.** O que a equipe pode alterar num pedido depois que ele foi feito, e o que **não** pode. Cada ação abaixo tem sua regra detalhada na seção indicada; esta é a visão de conjunto.

| Ação | Quando é permitida | Regra | Notifica o cliente? |
|---|---|---|---|
| **Reduzir / remover itens** (§15.4) | Só enquanto o pedido está **aguardando validação** | Só dá para **reduzir quantidade ou remover** item — nunca aumentar nem adicionar item novo | Sim — "pedido ajustado" |
| **Validar** (aceitar) | Pedido **aguardando validação** | Baixa o estoque de verdade; o vendedor pode informar a **previsão de entrega** (opcional) | Sim — "pedido validado" (com a previsão de entrega) |
| **Concluir** (entrega realizada) | Pedido **confirmado** | Registra a data efetiva da entrega | Sim — "pedido entregue" |
| **Cancelar** | Pedido **aguardando validação** ou **confirmado** (nunca um pedido concluído ou já cancelado) | **Motivo obrigatório.** Se o pedido já estava confirmado, o estoque baixado é devolvido | Sim — "pedido cancelado" (com o motivo) |
| **Definir / remarcar a data de entrega** | Pedido **aguardando validação** ou **confirmado** | **Motivo obrigatório e interno** (rastreabilidade — o cliente nunca vê). Data no passado é recusada. Data igual à atual é recusada. Cada remarcação fica registrada no histórico de remarcações do pedido (para relatórios). Notifica sempre que dá certo, inclusive quando não havia previsão anterior | Sim — "data de entrega remarcada" (mostra a nova data; **sem** o motivo) |
| **Observação interna** | Qualquer status | Anotação livre da equipe sobre o pedido. **O cliente NUNCA vê este campo** — não é a mesma caixa da observação que o cliente escreveu no checkout (§19.3) | Não |

**O vendedor NÃO pode, hoje:** mudar a cidade de entrega do pedido, mudar a modalidade de entrega, ou editar a observação que o **cliente** escreveu no checkout. Também não pode aumentar quantidades nem adicionar itens (só reduzir/remover).

---

## 24. Módulo de Clientes (painel) — Fase 3, incremento 1 (insert-only, 04/09/2026)

**✅ Em vigor.** `/painel/clientes` — a equipe consulta e acompanha os clientes da loja (não confundir com `/painel/equipe`, §22, que é a gestão da própria equipe).

**Listagem:** filtra por status (ativo/inativo), busca por nome/e-mail/WhatsApp, e por cidade de entrega (incluindo "sem cidade cadastrada"). Cada cliente mostra quantos pedidos já fez.

**Ficha do cliente:** dados de cadastro, e as métricas do relacionamento com a loja — nº de pedidos, total gasto, ticket médio, data da última compra — mais o histórico completo de pedidos.

**Regra: o que conta como "pedido" nas métricas.** Só pedidos **confirmados** ou **entregues** (concluídos) entram no nº de pedidos, no total gasto e no ticket médio — são os únicos com venda de fato comprometida. Pedidos **aguardando validação** ainda podem ser recusados, então não contam como venda ainda. Pedidos **cancelados** também ficam de fora da média, mas aparecem separadamente na ficha como "pedidos cancelados" — um dado complementar, não uma venda.

**Roadmap desta frente (Fase 3, 3 incrementos):** incremento 1 (listagem + ficha) ✅; incremento 2 — cadastrar cliente novo (recebe e-mail pra criar a própria senha), desativar/reativar (para de logar, mas o histórico continua preservado e visível), reenviar link de redefinição de senha — **📌 desenho aprovado pelo PO em 04/09/2026, PENDENTE DE IMPLEMENTAÇÃO** (detalhe técnico completo em `ESCOPO_PROJETO.md` §0 item 53; decisão de nível de permissão — admin-only vs. qualquer staff — ainda em aberto); incremento 3 — carga de clientes em massa (planilha-modelo + upload + relatório do que deu certo/errado, com o motivo) — não iniciado.

**✅ Incremento 2 implementado em 04/09/2026 (insert-only, sucede a linha acima).** Decisão de permissão fechada pelo PO: **qualquer staff do tenant**, não admin-only — consistente com a leitura da listagem (incremento 1). As 4 ações ficam disponíveis tanto na listagem (`/painel/clientes`) quanto na ficha (`/painel/clientes/[id]`):

- **Criar cliente**: formulário (nome, e-mail, WhatsApp, cidade de entrega opcional, observações internas opcionais) — 1 passo só (diferente da equipe, `REGRAS_DE_NEGOCIO.md` §22, que precisa de 2). A conta nasce em `customers` automaticamente (nenhum `role` é enviado), e um e-mail para o cliente definir a própria senha é disparado em seguida — mesmo mecanismo já usado para a equipe.
- **Editar cliente**: nome, WhatsApp, cidade de entrega e observações internas. O e-mail nunca é editável aqui (é o identificador de login).
- **Desativar/reativar**: cliente desativado é bloqueado de comprar/logar (a camada de aplicação já trata conta inativa como anônima), mas todo o histórico de pedidos permanece intacto e visível na ficha. Pede confirmação antes de desativar.
- **Reenviar link de senha**: reenvia o mesmo e-mail de "definir senha" do passo de criação — útil se o primeiro se perdeu.

**Item de backlog registrado ao implementar (não corrigido agora, ver `ESCOPO_PROJETO.md` §1 "Checklist de pré-produção", item 2):** hoje uma conta desativada (cliente ou staff) que loga com senha correta não vê nenhuma mensagem explicando por que caiu de volta pro login — só é tratada como anônima mais adiante. Mexe no fluxo de login como um todo (staff incluso), por isso fica para uma frente própria de autenticação, não para o Inc 2.

**Testado com Chromium real contra a URL pública em 04/09/2026 (detalhe técnico completo em `ESCOPO_PROJETO.md` §0 item 53):** as 4 ações confirmadas ponta a ponta com um cliente de teste (contato real controlado pelo PO, nunca fabricado). Único achado: reenviar o link de senha logo em seguida de criar o cliente (ou de um reenvio anterior) pode devolver "Não foi possível reenviar o link agora." por alguns segundos — é o próprio limite de reenvio de e-mail do provedor (Supabase Auth), não um defeito; espera de cerca de um minuto resolve.

**📌 Incremento 3 (carga em massa) — decisão de escopo registrada em 04/09/2026, antes do desenho: sem disparo de e-mail de senha em massa.** O e-mail de "definir senha" do Supabase Auth sai hoje pelo remetente global da VLUMA (`noreply@vluma.com.br`, SMTP Zoho) — não um remetente do tenant. Disparar esse e-mail em volume numa importação concentraria risco de reputação/spam nesse domínio compartilhado, por causa da migração de dados de um único lojista. Fica adiado para a fase SaaS, junto da resolução do e-mail transacional por-tenant (débito registrado em `ESCOPO_PROJETO.md` §1 "Pilares adicionais do SaaS", item 10). No MVP, a carga em massa cria os clientes **sem** disparo de e-mail — o cliente importado fica "sem senha até definir sob demanda": o lojista usa "Reenviar senha" (incremento 2) quando precisar, ou o próprio cliente usa "esqueci minha senha" ao voltar pra comprar.

**✅ Incremento 3 implementado em 04/09/2026 (insert-only, sucede a linha acima) — Fase 3 completa (3 de 3 incrementos).** `/painel/clientes`, botão "Importar clientes": baixa um modelo (CSV ou XLSX, 4 colunas — e-mail, nome, whatsapp, cidade), o lojista preenche e faz upload do mesmo formato de volta. A carga é **parcial**: linhas válidas são importadas, linhas inválidas ficam de fora e aparecem num relatório com o número da linha e o motivo em português claro (e-mail vazio/inválido/já cadastrado/repetido no próprio arquivo, nome vazio, whatsapp vazio/inválido, cidade que não bate com nenhuma cidade cadastrada). Um e-mail já cadastrado **nunca** sobrescreve o cliente existente — a linha é só reportada como erro. Tela mostra o progresso durante a importação e, ao final, um resumo (quantas entraram, quantas falharam) mais a opção de baixar o relatório completo. Detalhe técnico completo (função de criação compartilhada com o incremento 2, isolamento por linha, parsing client-side) em `ESCOPO_PROJETO.md` §0 item 56.

**Testado com Chromium real contra a URL pública em 04/09/2026** (detalhe completo em `ESCOPO_PROJETO.md` §0 item 56): arquivo com 7 linhas cobrindo os 5 tipos de erro de uma vez — 3 entraram certinho (sem e-mail de senha disparado), as outras 4 apareceram no relatório com o motivo certo, e uma linha ruim nunca afetou as boas do mesmo arquivo. Reconfirmado que criar cliente individual (incremento 2) continua funcionando normalmente depois da refatoração que reaproveitou o código entre as duas telas.

---

## 25. Importação de produtos via planilha (Frente A — Catálogo em Escala, Incremento 1, insert-only 04/09/2026)

**✅ Em vigor.** `/painel/produtos`, botão "Importar produtos" — carrega o catálogo em massa a partir de uma planilha (CSV ou XLSX), pensado pra quando o lojista está migrando um catálogo real de outro sistema (o do Cauã tem ~1.000 itens — cadastro item a item não é viável nessa escala).

**Formato da planilha — uma linha por variação.** Cada produto pode ter uma ou mais variações (tamanhos, cores, etc. — ver §4.4); a planilha reflete isso: cada linha é uma variação, e um **identificador** (coluna própria) diz quais linhas pertencem ao mesmo produto.

- **Produto com uma única variação** (o caso mais comum — ex.: um saco de ração que não tem tamanho): não precisa preencher o identificador, a linha já é o produto inteiro sozinho.
- **Produto com várias variações** (ex.: um aquário "Pequeno" e "Grande"): preenche o **mesmo identificador** em todas as linhas daquele produto — pode ser qualquer código que o lojista escolher, só serve pra agrupar. Os dados do produto (nome, categoria, etc.) só precisam ser preenchidos na **primeira** linha do grupo; nas linhas seguintes do mesmo produto, esses campos podem ficar em branco.

**Colunas da planilha:**
| Coluna | Nível | Obrigatória? | Observação |
|---|---|---|---|
| `identificador` | Produto | Não | Só necessário quando o produto tem mais de uma variação |
| `nome` | Produto | Sim | |
| `descricao` | Produto | Não | |
| `categoria` | Produto | Sim | Nome da categoria — se não existir, é **criada automaticamente**, com confirmação antes de aplicar |
| `unidade` | Produto | Não | Nome da unidade de venda cadastrada (Kg, Unidade, etc.) — em branco assume "Unidade" |
| `codigo` | Produto | Não | Código de referência do produto — útil pra quem está migrando de outro sistema e já tem uma codificação própria; em branco, o sistema gera um automaticamente |
| `destaque` | Produto | Não | "sim"/"não" |
| `codigo_visivel` | Produto | Não | "sim"/"não" — se o código aparece pro cliente na vitrine |
| `variacao_nome` | Variação | Não | Em branco vira "Padrão" |
| `sku` | Variação | Não | Em branco, o sistema gera automaticamente (mesma regra da tela manual, §4.4) |
| `preco` | Variação | Sim | Aceita vírgula ou ponto decimal |
| `preco_promocional` | Variação | Não | Precisa ser menor que o preço normal |
| `estoque` | Variação | Não | Estoque inicial — em branco, nasce zerado |
| `quantidade_minima_estoque` | Variação | Não | Alerta de reposição (§4.4) — em branco assume 1 |
| `quantidade_minima_venda` | Variação | Não | Mínimo de compra do cliente (checkout futuro) — em branco assume 1 |

**Categorias novas, sempre com confirmação antes de aplicar** (mesmo princípio já usado no resto do painel): a tela mostra "vou criar N categorias novas: [lista]" antes de importar qualquer coisa.

**Carga parcial, mas atômica por produto** — decisão de produto tomada com o PO: um produto só é criado **inteiro** (com todas as suas variações) ou **não é criado de jeito nenhum**. Se uma das variações de um produto tiver um erro (preço inválido, SKU repetido, etc.), o **produto inteiro** fica de fora da importação — nunca entra "pela metade" com só as variações boas. Os **outros produtos** da mesma planilha continuam sendo importados normalmente; só o produto com problema fica de fora, reportado no relatório com o motivo exato.

**Um SKU ou código já usado nunca sobrescreve um produto existente** — a linha/produto é reportado como erro no relatório, mesmo princípio já usado na importação de Clientes (§24) e no resto do painel (nunca excluir/sobrescrever sem ação explícita do lojista).

**Relatório de resultado**: mostra quantos produtos entraram, quantos falharam (e por quê, um a um) e quantas categorias novas foram criadas — com opção de baixar o relatório completo.

**Fora do escopo deste incremento** (fica para incrementos futuros da mesma frente): características por categoria (ficha técnica, §4.3/§4.7) e fotos dos produtos — o fluxo completo da frente é importar dados → exportar com os códigos das variações (SKU) → nomear as fotos pelos SKUs → importar as fotos, mas só a primeira etapa (dados) está pronta agora.

---

*Ver `docs/ESCOPO_PROJETO.md` para a visão técnica (stack, modelo de dados, arquitetura) por trás destas regras.*

*Entregável planejado: ao final do desenvolvimento, este documento é a base para gerar o **manual formal do usuário/lojista** — por isso a linguagem aqui evita jargão técnico desde o início.*
