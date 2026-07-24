'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type DeliveryCity = {
  id: string
  nome: string
  uf: string | null
}

export function useDeliveryCities() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['delivery_cities'],
    queryFn: async (): Promise<DeliveryCity[]> => {
      const { data, error } = await supabase
        .from('delivery_cities')
        .select('id, nome, uf')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}
