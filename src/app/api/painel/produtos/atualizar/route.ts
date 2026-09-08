import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { removerImagemComoStaff } from '@/lib/painel/produtos'

// Frente A, incremento 4 (atualização em massa via reimportação) -
// aprovado pelo PO em 08/09/2026. Recebe um LOTE de GRUPOS por produto
// (código + variações por SKU) já parseados/agrupados no browser -
// atômico por produto (uma chamada da RPC = uma transação), parcial
// entre produtos (try/catch por grupo, mesmo padrão do Inc 1).
//
// Casamento por código+SKU é feito PELA PRÓPRIA RPC
// atualizar_produto_via_importacao (migration 053) - ela já devolve
// mensagens amigáveis pros 4 erros de casamento (código vazio/não
// encontrado, SKU vazio/não encontrado, SKU de outro produto). Este
// Route Handler só faz a validação que a RPC NÃO cobre bem: formato
// numérico de preço/promocional/estoque (um cast direto de texto
// inválido dentro do PL/pgSQL geraria um erro cru do Postgres, não
// uma mensagem amigável) - a RPC continua sendo a autoridade final
// pras regras de negócio (preço negativo, promocional >= preço,
// saldo insuficiente), via CHECK constraints com mensagem própria.
const variacaoSchema = z.object({
  linha: z.number().int().positive(),
  sku: z.string(),
  preco: z.string(),
  preco_promocional: z.string(),
  estoque: z.string(),
  acao_foto: z.string(),
})

const grupoSchema = z.object({
  linhas: z.array(z.number().int().positive()).min(1),
  codigo: z.string(),
  nome: z.string(),
  descricao: z.string(),
  variacoes: z.array(variacaoSchema).min(1),
})

const loteSchema = z.object({
  grupos: z.array(grupoSchema).min(1).max(20),
})

export type ResultadoAtualizacaoGrupo =
  | {
      linhas: number[]
      codigo: string
      nome: string
      status: 'sucesso'
      fotosRemovidas: number
      falhaRemocaoFoto?: string
    }
  | { linhas: number[]; codigo: string; nome: string; status: 'erro'; motivo: string }

// Aceita "12.50" e o formato BR "12,50"; estoque_entrada pode ser
// negativo (saída, decisão do PO em 08/09/2026).
function paraNumero(v: string): number | null {
  const limpo = v.trim()
  if (!limpo) return null
  const normalizado = /,\d{1,2}$/.test(limpo) && !limpo.includes('.') ? limpo.replace(',', '.') : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

function paraInteiro(v: string): number | null {
  const n = paraNumero(v)
  return n === null ? null : Math.trunc(n)
}

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = loteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Lote inválido.' }, { status: 400 })
  }

  const supabase = await createClient()

  const resultados: ResultadoAtualizacaoGrupo[] = []
  for (const grupo of parsed.data.grupos) {
    try {
      resultados.push(await processarGrupo(grupo, supabase))
    } catch {
      resultados.push({
        linhas: grupo.linhas,
        codigo: grupo.codigo.trim(),
        nome: grupo.nome.trim() || grupo.codigo.trim(),
        status: 'erro',
        motivo: 'Não foi possível processar este produto. Tente novamente.',
      })
    }
  }

  return NextResponse.json({ resultados })
}

async function processarGrupo(
  grupo: z.infer<typeof grupoSchema>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ResultadoAtualizacaoGrupo> {
  const codigo = grupo.codigo.trim()
  const nomeArquivo = grupo.nome.trim()
  const rotulo = nomeArquivo || codigo

  const erro = (motivo: string): ResultadoAtualizacaoGrupo => ({
    linhas: grupo.linhas,
    codigo,
    nome: rotulo,
    status: 'erro',
    motivo,
  })

  if (!codigo) return erro('Código do produto vazio — obrigatório na atualização.')

  // ---------- valida formato numérico ANTES de chamar a RPC ----------
  const variacoesPayload: {
    sku: string
    preco: number | null
    preco_promocional: number | null
    estoque_entrada: number | null
    acao_foto: string
  }[] = []

  for (const v of grupo.variacoes) {
    const sku = v.sku.trim()
    if (!sku) return erro(`Linha ${v.linha}: SKU vazio — obrigatório para casar a variação na atualização.`)

    let preco: number | null = null
    if (v.preco.trim()) {
      preco = paraNumero(v.preco)
      if (preco === null) return erro(`Linha ${v.linha}: preço inválido.`)
    }

    let precoPromocional: number | null = null
    if (v.preco_promocional.trim()) {
      precoPromocional = paraNumero(v.preco_promocional)
      if (precoPromocional === null) return erro(`Linha ${v.linha}: preço promocional inválido.`)
    }

    let estoqueEntrada: number | null = null
    if (v.estoque.trim()) {
      estoqueEntrada = paraInteiro(v.estoque)
      if (estoqueEntrada === null) return erro(`Linha ${v.linha}: quantidade de estoque inválida.`)
    }

    const acaoFoto = v.acao_foto.trim().toLowerCase()
    if (acaoFoto && acaoFoto !== 'remover') {
      return erro(`Linha ${v.linha}: ação de foto "${v.acao_foto}" não reconhecida (use "remover" ou deixe em branco).`)
    }

    variacoesPayload.push({ sku, preco, preco_promocional: precoPromocional, estoque_entrada: estoqueEntrada, acao_foto: acaoFoto })
  }

  // ---------- casamento código+SKU e atualização de dados+estoque, tudo na RPC (atômico) ----------
  const { data: produtoAtualizado, error } = await supabase.rpc('atualizar_produto_via_importacao', {
    p_codigo: codigo,
    p_produto: { nome: nomeArquivo || null, descricao: grupo.descricao.trim() || null },
    p_variacoes: variacoesPayload.map((v) => ({
      sku: v.sku,
      preco: v.preco,
      preco_promocional: v.preco_promocional,
      estoque_entrada: v.estoque_entrada,
    })),
  })

  if (error) return erro(error.message)

  // ---------- acao_foto=remover: FORA da transação da RPC, só se ela teve sucesso ----------
  // Postgres não fala com o Storage - reaproveita a MESMA rota de
  // exclusão já corrigida (removerImagemComoStaff), escopo = fotos da
  // VARIAÇÃO (variant_id), nunca do produto inteiro. Falha parcial
  // aqui não desfaz a atualização de dados/estoque já confirmada -
  // reportada explicitamente no resultado, nunca silenciosa.
  const skusParaRemoverFoto = variacoesPayload.filter((v) => v.acao_foto === 'remover').map((v) => v.sku)
  let fotosRemovidas = 0
  const falhas: string[] = []

  if (skusParaRemoverFoto.length > 0) {
    const { data: variantes } = await supabase
      .from('product_variants')
      .select('id, sku')
      .eq('product_id', produtoAtualizado.id)
      .in('sku', skusParaRemoverFoto)

    for (const variante of variantes ?? []) {
      const { data: imagens } = await supabase
        .from('product_images')
        .select('id, storage_path')
        .eq('variant_id', variante.id)

      for (const imagem of imagens ?? []) {
        const resultado = await removerImagemComoStaff(supabase, { imageId: imagem.id, storagePath: imagem.storage_path })
        if (resultado.ok) fotosRemovidas++
        else falhas.push(`SKU "${variante.sku}": ${resultado.error}`)
      }
    }
  }

  return {
    linhas: grupo.linhas,
    codigo,
    nome: produtoAtualizado.nome ?? rotulo,
    status: 'sucesso',
    fotosRemovidas,
    ...(falhas.length > 0 ? { falhaRemocaoFoto: falhas.join('; ') } : {}),
  }
}
