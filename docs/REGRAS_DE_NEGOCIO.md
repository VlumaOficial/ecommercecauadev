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

**Fotos por variação (📐 decidida e ✅ implementada em 03/08/2026):** além das fotos gerais do produto (galeria principal, até 10 imagens — ver `ESCOPO_PROJETO.md` §4), cada variação pode opcionalmente ter suas próprias fotos (até 5), pensado para o caso de tamanhos/cores visualmente diferentes entre si dentro do mesmo produto. É **opcional**: uma variação sem fotos próprias simplesmente usa as fotos gerais do produto — o lojista só precisa fotografar a variação separadamente quando isso realmente ajudar o cliente a diferenciar (ex.: "Pequeno" e "Grande" de um peixe que muda de cor com a idade). No painel, o uploader de cada variação fica **recolhido por padrão** dentro do formulário de edição, para não sobrecarregar a tela de quem só usa a galeria geral. Segue a mesma regra de exclusão real (não soft delete) já registrada em §3.2.

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

*Ver `docs/ESCOPO_PROJETO.md` para a visão técnica (stack, modelo de dados, arquitetura) por trás destas regras.*

*Entregável planejado: ao final do desenvolvimento, este documento é a base para gerar o **manual formal do usuário/lojista** — por isso a linguagem aqui evita jargão técnico desde o início.*
