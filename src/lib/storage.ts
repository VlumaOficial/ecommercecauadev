import { createClient } from '@/lib/supabase/client'

// getPublicUrl() e so montagem de string (sem chamada de rede, sem
// precisar de sessao) - seguro de usar com o client anonimo do
// navegador mesmo neste projeto (que nunca chama dado autenticado
// direto do client). Bucket "product-images" e publico (migration 023).
export function getProductImageUrl(storagePath: string): string {
  const supabase = createClient()
  return supabase.storage.from('product-images').getPublicUrl(storagePath).data.publicUrl
}
