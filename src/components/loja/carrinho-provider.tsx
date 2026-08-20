'use client'

import { createContext, useContext, useRef } from 'react'
import { useStore } from 'zustand'
import { criarCarrinhoStore, type CarrinhoStoreApi, type CarrinhoState } from '@/lib/loja/carrinho-store'

// Regras do carrinho - sempre lidas de store_settings (nunca fixas
// no codigo, REGRAS_DE_NEGOCIO.md §11.1), buscadas UMA vez no
// (loja)/layout.tsx (Server Component) e propagadas por aqui - evita
// cada componente client que precisa delas (VariacoesSelector,
// CarrinhoDrawer) refazer o fetch de get_public_store_settings.
export type CarrinhoRegras = {
  pedidosAbertos: boolean
  mensagemPedidosFechados: string | null
  valorMinimoPedido: number
  valorMinimoPedidoHabilitado: boolean
}

type CarrinhoContextValue = {
  store: CarrinhoStoreApi
  regras: CarrinhoRegras
}

const CarrinhoContext = createContext<CarrinhoContextValue | null>(null)

export function CarrinhoProvider({
  tenantSlug,
  regras,
  children,
}: {
  tenantSlug: string
  regras: CarrinhoRegras
  children: React.ReactNode
}) {
  // useRef (nao useState/module-level) - a store so' precisa existir
  // uma vez por sessao de navegador, criada com o tenantSlug certo;
  // padrao recomendado pra zustand + React (evita singleton de
  // modulo, que causaria estado compartilhado entre requests/tenants
  // num cenario SSR multi-tenant).
  const storeRef = useRef<CarrinhoStoreApi | null>(null)
  if (!storeRef.current) {
    storeRef.current = criarCarrinhoStore(tenantSlug)
  }

  return (
    <CarrinhoContext.Provider value={{ store: storeRef.current, regras }}>
      {children}
    </CarrinhoContext.Provider>
  )
}

function useCarrinhoContext(): CarrinhoContextValue {
  const ctx = useContext(CarrinhoContext)
  if (!ctx) {
    throw new Error('useCarrinho/useCarrinhoRegras precisam estar dentro de <CarrinhoProvider>.')
  }
  return ctx
}

export function useCarrinho<T>(selector: (state: CarrinhoState) => T): T {
  const { store } = useCarrinhoContext()
  return useStore(store, selector)
}

export function useCarrinhoRegras(): CarrinhoRegras {
  return useCarrinhoContext().regras
}
