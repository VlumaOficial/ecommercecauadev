import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/lib/auth'
import { criarClienteComoStaff } from '@/lib/painel/clientes'

// Fase 3, incremento 3 (carga em massa) - aprovado pelo PO em 04/09/2026.
// Recebe um LOTE de linhas já parseadas no browser (parseSpreadsheetFile,
// src/lib/importacao/) - o parsing em si nunca acontece aqui, só a
// validação/criação. O client envia o arquivo inteiro em vários lotes
// sequenciais (~25 linhas cada, ver ImportarClientesDialog) - cada
// requisição fica curta o bastante pra nunca esbarrar em timeout de
// Route Handler, não importa o tamanho do arquivo original.
const linhaSchema = z.object({
  linha: z.number().int().positive(),
  nome: z.string(),
  email: z.string(),
  whatsapp: z.string(),
  cidade: z.string(),
})

const loteSchema = z.object({
  linhas: z.array(linhaSchema).min(1).max(100),
})

const EMAIL_REGEX = z.string().email()

export type ResultadoLinha =
  | { linha: number; status: 'sucesso'; clienteId: string; emailEnviado: boolean | null }
  | { linha: number; status: 'erro'; motivo: string }

export async function POST(request: NextRequest) {
  const perfil = await getStaffProfile()
  if (!perfil) {
    return NextResponse.json({ error: 'Acesso restrito a equipe.' }, { status: 403 })
  }
  // Qualquer staff do tenant (mesma decisão do Inc 2) - consistente com
  // criar/editar/desativar cliente individualmente.

  const body = await request.json().catch(() => null)
  const parsed = loteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Lote inválido.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Cidades ATIVAS do tenant, buscadas UMA vez pro lote inteiro (nunca
  // 1 query por linha) - casamento por nome, case-insensitive/trim.
  const { data: cidades } = await supabase
    .from('delivery_cities')
    .select('id, nome')
    .eq('tenant_id', perfil.tenant_id)
    .eq('ativo', true)
  const cidadesPorNome = new Map((cidades ?? []).map((c) => [normalizarTexto(c.nome), c.id]))

  const origin = new URL(request.url).origin

  // Isolamento por linha (crítico): cada linha do lote é processada de
  // forma independente, com try/catch próprio - um erro inesperado
  // numa linha (validação ou criação) vira uma entrada de erro no log,
  // nunca derruba as demais linhas do MESMO lote. Sequencial (não
  // Promise.all) de propósito - evita disparar N chamadas simultâneas
  // contra a Admin API do Supabase Auth num único lote.
  const resultados: ResultadoLinha[] = []
  for (const linha of parsed.data.linhas) {
    try {
      resultados.push(await processarLinha(linha, cidadesPorNome, origin))
    } catch {
      resultados.push({ linha: linha.linha, status: 'erro', motivo: 'Não foi possível processar esta linha. Tente novamente.' })
    }
  }

  return NextResponse.json({ resultados })
}

function normalizarTexto(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

async function processarLinha(
  linha: z.infer<typeof linhaSchema>,
  cidadesPorNome: Map<string, string>,
  origin: string
): Promise<ResultadoLinha> {
  const erro = (motivo: string): ResultadoLinha => ({ linha: linha.linha, status: 'erro', motivo })

  const nome = linha.nome.trim()
  const email = linha.email.trim()
  const whatsappDigitos = linha.whatsapp.replace(/\D/g, '')
  const cidadeNome = linha.cidade.trim()

  // Revalidação completa server-side - nunca confia no que o browser já
  // validou. Ordem: e-mail -> nome -> whatsapp -> cidade -> criação (o
  // "já cadastrado" só é conhecido no momento da criação em si).
  if (!email) return erro('E-mail vazio.')
  if (!EMAIL_REGEX.safeParse(email).success) return erro('E-mail inválido.')
  if (!nome) return erro('Nome vazio.')
  if (!(whatsappDigitos.length === 10 || whatsappDigitos.length === 11)) return erro('WhatsApp vazio ou inválido.')

  let deliveryCityId: string | null = null
  if (cidadeNome) {
    const encontrada = cidadesPorNome.get(normalizarTexto(cidadeNome))
    if (!encontrada) return erro('Cidade não encontrada — confira o nome digitado.')
    deliveryCityId = encontrada
  }

  const resultado = await criarClienteComoStaff({
    nome,
    email,
    whatsapp: whatsappDigitos,
    delivery_city_id: deliveryCityId,
    observacoes: null,
    // Decisão de produto (ESCOPO_PROJETO.md §0 item 55): importação em
    // massa NUNCA dispara e-mail de senha - fica pra fase SaaS, junto do
    // e-mail transacional por-tenant.
    enviarEmail: false,
    origin,
  })

  if (!resultado.ok) return erro(resultado.error)

  return { linha: linha.linha, status: 'sucesso', clienteId: resultado.cliente.id, emailEnviado: resultado.emailEnviado }
}
