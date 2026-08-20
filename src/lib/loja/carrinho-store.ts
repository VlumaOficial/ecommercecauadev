import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'

// Carrinho client-side (Fase 2, incremento 4, REGRAS_DE_NEGOCIO.md
// §11.1) — vive so no navegador, nunca numa tabela do banco.
// Snapshot completo por item (nao so variantId+quantidade): o preco
// aqui e' so pra exibicao no drawer, a RPC criar_pedido (incremento
// 3) sempre releio o preco real de product_variants no momento do
// pedido - um preco desatualizado aqui e' puramente cosmetico, nunca
// afeta o que de fato e' cobrado.
export type ItemCarrinho = {
  variantId: string
  productId: string
  productSlug: string
  productNome: string
  variantNome: string
  imagemPath: string | null
  preco: number
  precoPromocional: number | null
  quantidadeMinimaVenda: number
  quantidade: number
}

export type CarrinhoState = {
  itens: ItemCarrinho[]
  adicionarItem: (item: Omit<ItemCarrinho, 'quantidade'>, quantidade: number) => void
  removerItem: (variantId: string) => void
  alterarQuantidade: (variantId: string, quantidade: number) => void
  limparCarrinho: () => void
}

export type CarrinhoStoreApi = ReturnType<typeof criarCarrinhoStore>

// Store criada por FABRICA (nao um singleton de modulo) - o nome da
// persistencia depende do tenant (chave `carrinho:${tenantSlug}`, ja
// pensada pra Fase SaaS: navegar entre lojas diferentes nunca mistura
// carrinho de uma com o de outra). CarrinhoProvider instancia isso
// uma vez por sessao de navegador via useRef.
export function criarCarrinhoStore(tenantSlug: string) {
  return createStore<CarrinhoState>()(
    persist(
      (set) => ({
        itens: [],

        adicionarItem: (item, quantidade) =>
          set((state) => {
            const existente = state.itens.find((i) => i.variantId === item.variantId)
            if (existente) {
              return {
                itens: state.itens.map((i) =>
                  i.variantId === item.variantId ? { ...i, quantidade: i.quantidade + quantidade } : i
                ),
              }
            }
            return { itens: [...state.itens, { ...item, quantidade }] }
          }),

        removerItem: (variantId) =>
          set((state) => ({
            itens: state.itens.filter((i) => i.variantId !== variantId),
          })),

        // Nunca deixa a quantidade cair abaixo do minimo de venda da
        // variacao - sair do carrinho e' sempre uma acao explicita
        // (remover), nao um decremento acidental ate zero.
        alterarQuantidade: (variantId, quantidade) =>
          set((state) => ({
            itens: state.itens.map((i) =>
              i.variantId === variantId ? { ...i, quantidade: Math.max(quantidade, i.quantidadeMinimaVenda) } : i
            ),
          })),

        limparCarrinho: () => set({ itens: [] }),
      }),
      { name: `carrinho:${tenantSlug}` }
    )
  )
}
