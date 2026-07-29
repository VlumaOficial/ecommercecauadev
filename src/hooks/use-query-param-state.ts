'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Sincroniza um filtro simples (string) com a URL via query param.
// Padrao reutilizavel para filtros/busca em qualquer tela do painel:
// o estado sobrevive a reload e e compartilhavel via link.
export function useQueryParamState(key: string, defaultValue: string) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!next || next === defaultValue) {
        params.delete(key)
      } else {
        params.set(key, next)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [key, defaultValue, pathname, router, searchParams]
  )

  return [value, setValue] as const
}
