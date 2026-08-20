# REGRAS DE NEGÓCIO — E-commerce Criatório Capuã

**Última atualização:** 01/08/2026 (data original de criação do documento: 30/07/2026)
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

**📐 Decidida e modelada, migration `007` aplicada no banco.** **✅ Em vigor no lado da leitura desde 12/08/2026** — a Vitrine pública (`(loja)/**`, Fase 1 Etapa 2) já respeita os dois níveis: `loja_aberta=false` mostra só a mensagem, sem header/nav/catálogo nenhum; `pedidos_abertos=false` (com loja aberta) mostra uma faixa com `mensagem_pedidos_fechados` acima do catálogo, que continua navegável — não há botão de finalizar pedido ainda pra bloquear de verdade (Carrinho/Checkout é fase futura), então esse nível só afeta o aviso por enquanto. **UI de configuração pro lojista editar os dois campos ainda não existe** — a Etapa 4 do plano da Vitrine Fase 1 (`ESCOPO_PROJETO.md` §0 itens 28/29, concluída em 14/08/2026) ficou restrita a banner/selos/WhatsApp/identidade (o que os pedidos da etapa listaram); `loja_aberta`/`pedidos_abertos`/as duas mensagens de fechamento **continuam só editáveis por SQL direto**, sem tela — pendência real pra uma etapa futura (fora do escopo do que já foi pedido), não coberta por engano.

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

**📌 Pendências registradas com o PO em 15/08/2026 (continuação da Fase 2 — §§15–16), a decidir nas próximas conversas ANTES de implementar:**

- **(a) Política de cancelamento configurável**: ~~manual pelo vendedor + automático por tempo (prazo a definir) — o que o cliente é avisado quando isso acontece, e como/quando o estoque reservado (§16) é liberado de volta.~~ **✅ Decidido com o PO em 18/08/2026** — ver §17 (cancelamento manual + automático configurável/desligável, libera estoque nos dois casos) e §18.1 (cliente notificado). Ainda não implementado, só decidido.
- **(b) Fluxo A (§15.3) em detalhe**: ~~o que exatamente significa o vendedor "validar" um pedido, e o que ele pode alterar no pedido antes de validar (ex.: substituir item indisponível, ajustar quantidade).~~ **✅ Decidido com o PO em 18/08/2026** — ver §15.4 (vendedor só pode reduzir/remover item ao validar, nunca aumentar nem adicionar item novo). Ainda não implementado, só decidido.
- **(c) Notificações**: ~~mecânica de disparo de e-mail + WhatsApp pro cliente (confirmação, validação, cancelamento) — o WhatsApp depende de uma integração ainda não escolhida/implementada (ex. Evolution API, já mencionada na visão original do produto).~~ **✅ Decidido com o PO em 18/08/2026** — ver §18 (e-mail + Área do Cliente "Meus Pedidos" no MVP; WhatsApp de saída via Evolution API no MVP; WhatsApp conversacional de entrada via N8N em fase seguinte, não MVP). Ainda não implementado, só decidido.
- **(d) Fluxo B (Asaas) completo**: integração de pagamento via Asaas, webhook de confirmação, atualização automática de status — ainda não esboçado em detalhe, entra junto da fase de pagamento. **Única pendência real que permanece em aberto desta lista.**

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

**📐 Decidido com o PO em 20/08/2026, ainda NÃO implementado — correção pendente do Bug 1 registrado em `ESCOPO_PROJETO.md` §0.**

Quando um cadastro é tentado com um e-mail que já tem conta, a mensagem mostrada ao cliente **nunca confirma nem nega** que aquele e-mail já está cadastrado — decisão de produto pensada pro SaaS (qualquer lojista, não só o Cauã), não uma peculiaridade desta loja. Motivo: revelar "esse e-mail já existe" ajuda um atacante a enumerar quais endereços têm conta na plataforma (varrer uma lista de e-mails e descobrir quais "batem"), o mesmo raciocínio de segurança que já motiva o próprio Supabase Auth a devolver sucesso silencioso (sem erro, sem criar nada) numa tentativa de `signUp()` com e-mail existente. A tela deve reagir a esse caso de forma que **pareça idêntica** à de um cadastro novo bem-sucedido (mesma mensagem "confirme seu e-mail", por exemplo) — nunca um alerta específico tipo "este e-mail já possui cadastro". Detecção técnica: `data.user.identities.length === 0` na resposta do `signUp()` é o sinal (documentado do Supabase) de que nada foi criado de verdade — usado só pra decidir o comportamento interno (ex.: não reenviar e-mail de um jeito diferente), nunca pra mudar a mensagem visível de um jeito que entregue a informação ao cliente.

### 14.2 WhatsApp sem restrição de unicidade — decisão consciente, não descuido

**📐 Decidido com o PO em 20/08/2026.**

`customers.whatsapp` **não tem** nem vai ganhar, por enquanto, nenhuma restrição de unicidade — o mesmo número de telefone pode estar associado a mais de uma conta de cliente. O identificador único de conta é o **e-mail** (login), não o telefone. Decisão consciente, não uma lacuna esquecida: casos legítimos existem (familiares/funcionários compartilhando um número de contato, ou alguém que cria uma segunda conta com e-mail diferente mas mesmo WhatsApp) — impor unicidade aqui bloquearia esses casos sem necessidade real de negócio identificada até agora. Revisável no futuro se surgir um motivo concreto.

---

## 15. Checkout — fluxo e identificação (Fase 2)

**📐 Decidido com o PO em 15/08/2026, complementa §§11–14.**

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

---

## 18. Notificações e Área do Cliente (Fase 2)

**📐 Decidido com o PO em 18/08/2026.**

### 18.1 Quando o cliente é notificado

O cliente é notificado sempre que o pedido muda de estado por ação do vendedor ou do sistema: **validação** (aceito), **ajuste** (itens reduzidos/removidos — §15.4) e **cancelamento** (§17). A notificação avisa da novidade e direciona o cliente pra área do cliente (§18.2), que é onde ele vê o detalhe completo — a notificação em si é só o aviso, não o lugar de conferir os dados.

### 18.2 Área do cliente ("Meus Pedidos") — nasce no MVP

Cliente logado (§14) tem uma área própria pra ver os pedidos que fez, com o **estado final e atualizado** de cada um — itens, ajustes feitos pelo vendedor, total, status. É a **fonte de verdade** do acompanhamento do pedido: qualquer dúvida sobre "o que ficou combinado", a resposta está lá, sempre refletindo o estado mais recente (não uma cópia estática do momento da finalização).

**PDF do pedido não é o mecanismo principal** — fica como opção secundária/futura (útil pra imprimir ou guardar localmente, mas a área do cliente é o canal oficial de acompanhamento, sempre atualizado; um PDF gerado na finalização ficaria desatualizado assim que o vendedor ajustasse o pedido).

### 18.3 Canais de notificação: e-mail + WhatsApp, dois níveis de WhatsApp

**E-mail** e a **área do cliente** (§18.2) entram no MVP como canais/registro padrão.

**WhatsApp em dois níveis, faseados**:

| Nível | O que é | Integração | Fase |
|---|---|---|---|
| **1 — Saída** | O sistema avisa o cliente (confirmação, validação, ajuste, cancelamento) — mensagem parte do sistema, cliente só recebe | **Evolution API** (já cogitada na visão original do produto) | **MVP** |
| **2 — Entrada** | Cliente manda mensagem perguntando sobre o pedido e o sistema responde — atendimento conversacional | **N8N** | **Fase seguinte** (não MVP) |

A arquitetura de notificação nasce pensada pra múltiplos canais desde o início (e-mail + WhatsApp de saída juntos no MVP), com o conversacional (N8N, Nível 2) como incremento posterior — não uma reescrita.

### 18.4 Área do cliente — editar dados cadastrais e trocar senha

**📐 Decidido com o PO em 18/08/2026, complementa §18.2.**

Além de "Meus Pedidos" (§18.2), a área do cliente no MVP inclui:

- **Editar dados cadastrais**: nome, telefone, e-mail, cidade de entrega padrão.
- **Trocar senha**.

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

**📐 Decidido com o PO em 18/08/2026, detalha a operação de "Validar" do Fluxo A (§15.3/§15.4).**

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

*Ver `docs/ESCOPO_PROJETO.md` para a visão técnica (stack, modelo de dados, arquitetura) por trás destas regras.*

*Entregável planejado: ao final do desenvolvimento, este documento é a base para gerar o **manual formal do usuário/lojista** — por isso a linguagem aqui evita jargão técnico desde o início.*
