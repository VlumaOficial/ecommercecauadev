import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/types/database'
import { derivarPrefixo } from '@/lib/produto-codigo'

type SupabaseServerClient = SupabaseClient<Database>

export type CriarCategoriaDados = {
  nome: string
  slug: string
  parent_id: string | null
  descricao: string | null
  ativo: boolean
}

export type CriarCategoriaResultado =
  | { ok: true; categoria: Tables<'categories'> }
  | { ok: false; error: string }

// Extraída de POST /api/painel/categorias (Fase 1) para ser reaproveitada
// pela importação de produtos (Frente A, Inc 1) na criação automática de
// categorias novas detectadas no preview. Insere tratando a colisão do
// índice único de prefixo: se o prefixo veio VAZIO (deriva do nome),
// tenta ajustar sozinho com sufixo numérico (CIC, CIC0001, CIC0002...)
// até achar um livre. Se veio DIGITADO, colisão vira erro - nunca
// inventa outro valor por baixo dos panos.
export async function criarCategoriaComoStaff(
  supabase: SupabaseServerClient,
  dados: CriarCategoriaDados,
  prefixoDigitado: string
): Promise<CriarCategoriaResultado> {
  const derivando = !prefixoDigitado
  const prefixoBase = derivando ? derivarPrefixo(dados.nome) : prefixoDigitado
  const maxTentativas = derivando ? 20 : 1

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const prefixoTentativa =
      tentativa === 0 ? prefixoBase : `${prefixoBase}${String(tentativa).padStart(4, '0')}`
    const { data, error } = await supabase
      .from('categories')
      .insert({ ...dados, prefixo_codigo: prefixoTentativa || null })
      .select()
      .single()

    if (!error) return { ok: true, categoria: data }

    const colidiuNoPrefixo = error.code === '23505' && error.message.includes('idx_categories_prefixo_codigo')
    if (!colidiuNoPrefixo) {
      const message = error.code === '23505' ? 'Já existe uma categoria com esse slug.' : error.message
      return { ok: false, error: message }
    }
    if (!derivando) {
      return { ok: false, error: 'Já existe uma categoria com este prefixo. Escolha outro.' }
    }
    // derivando automaticamente: colidiu, tenta o próximo sufixo
  }

  return {
    ok: false,
    error: 'Não foi possível gerar um prefixo único para esta categoria automaticamente. Digite um prefixo manualmente.',
  }
}
