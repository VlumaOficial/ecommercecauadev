import { createPublicClient } from '@/lib/supabase/public'
import type {
  CategoriaPublica,
  CidadeEntregaPublica,
  ConfiguracaoVitrineCampos,
  ProdutoDetalhe,
  ProdutoPublico,
  StoreSettingsPublico,
} from '@/lib/loja/types'

// Wrappers finos sobre as 4 RPCs publicas da Vitrine (migration 028,
// Fase 0). Cada uma resolve o tenant a partir do slug DENTRO da RPC -
// nunca aceitamos tenant_id vindo de fora. Erro de rede/RPC vira null
// (nao exception) - quem chama decide 404, nao existe fallback pra
// outro tenant.

// Defaults dos campos da Etapa 3 (migration 030) - identicos aos
// DEFAULT das colunas no banco. Só entram em jogo enquanto a
// migration não estiver aplicada (a RPC antiga não devolve essas
// chaves, undefined no lugar) - o spread abaixo garante que a
// vitrine nunca muda de aparência nesse intervalo, sem precisar de
// ?? espalhado em cada componente que consome store_settings.
const DEFAULTS_ETAPA3_IDENTIDADE = {
  banner_titulo: 'Peixes ornamentais direto do criatório',
  banner_subtitulo: 'Qualidade, saúde e variedade. Monte seu pedido e retire no ponto de encontro da sua cidade.',
  banner_botao_texto: 'Ver catálogo →',
  banner_botao_href: '/produtos',
  banner_tipo_fundo: 'cor' as const,
  banner_cor_fundo: '#0891b2',
  banner_imagem_path: null,
  selos: [
    { titulo: 'Retirada combinada', subtitulo: 'Ponto de encontro por cidade', icone: 'truck', ativo: true },
    { titulo: 'Chegada viva', subtitulo: 'Garantia no transporte', icone: 'shield-check', ativo: true },
    { titulo: 'Atendimento próximo', subtitulo: 'Fale direto pelo WhatsApp', icone: 'headset', ativo: true },
    { titulo: 'Criação própria', subtitulo: 'Direto do criatório', icone: 'fish', ativo: true },
  ],
  whatsapp_numero: null,
  whatsapp_mensagem: 'Olá! Vim da loja e gostaria de saber mais sobre os peixes.',
  cor_principal: '#0891b2',
  // Etapa 4 (migration 031) - null = usa o arquivo estatico
  // public/brand/logocp-icone.png, mesmo comportamento de antes desta
  // etapa (ver urlLogoLoja() em header.tsx/footer.tsx).
  logo_path: null,
  // Fase 2, incremento 2 (migration 036) - default true (fail-open):
  // enquanto a migration nao estiver aplicada em algum ambiente, o
  // /cadastro continua mostrando o formulario normalmente, em vez de
  // travar autocadastro por engano num campo que ainda nao existe.
  permite_autocadastro: true,
}

export async function getPublicStoreSettings(tenantSlug: string): Promise<StoreSettingsPublico | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_store_settings', { p_tenant_slug: tenantSlug })
  if (error || !data || data.length === 0) return null
  // banner_tipo_fundo vem como `string` genérico do tipo gerado do
  // banco (o valor real é restrito por CHECK - 'cor'|'imagem' - não
  // dá pra expressar isso no Returns da RPC sem duplicar o enum ali).
  return { ...DEFAULTS_ETAPA3_IDENTIDADE, ...data[0] } as StoreSettingsPublico
}

// Fase 2, incremento 1 (migration 032) - so cidades ATIVAS do tenant,
// usada pelo seletor de cidade do checkout (fase futura) e pelo
// dropdown de cidade do /cadastro (Fase 2 incremento 2) - substitui a
// query direta client-side que useDeliveryCities fazia antes (quebrada
// pra anonimo desde a migration 028, que fechou cities_select_anon).
export async function getPublicDeliveryCities(tenantSlug: string): Promise<CidadeEntregaPublica[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_delivery_cities', { p_tenant_slug: tenantSlug })
  if (error || !data) return []
  return data
}

export async function getPublicCategories(tenantSlug: string): Promise<CategoriaPublica[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_categories', { p_tenant_slug: tenantSlug })
  if (error || !data) return []
  return data
}

export async function getPublicProducts(tenantSlug: string): Promise<ProdutoPublico[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_products', { p_tenant_slug: tenantSlug })
  if (error || !data) return []
  return data
}

// Sobrepoe os campos editaveis do rascunho (Etapa 4) por cima do
// settings publicado - usado so' por src/app/vitrine-preview/page.tsx
// (protegida por sessao de staff, chama get_configuracao_vitrine com
// o client autenticado do painel - nao entra neste arquivo, que e' so
// a camada PUBLICA/anon), pra montar um StoreSettingsPublico "de
// mentira" com o rascunho, reaproveitando os MESMOS componentes
// (Header/BannerHero/SelosConfianca/Footer/...) da vitrine de
// verdade. Campos operacionais (nome/loja_aberta/etc, fora do escopo
// de rascunho/publicar) sempre vem do publicado.
export function mesclarRascunhoNoPublicado(
  publicado: StoreSettingsPublico,
  rascunho: ConfiguracaoVitrineCampos
): StoreSettingsPublico {
  return { ...publicado, ...rascunho }
}

export async function getPublicProductDetail(tenantSlug: string, produtoSlug: string): Promise<ProdutoDetalhe | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_product_detail', {
    p_tenant_slug: tenantSlug,
    p_slug: produtoSlug,
  })
  if (error || !data) return null
  return data as unknown as ProdutoDetalhe
}

// Bucket product-images e publico pra leitura (migration 023) - a URL
// e so' concatenacao, sem chamada de rede/assinatura.
export function urlImagemProduto(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`
}

// Mesmo bucket publico de product-images, reaproveitado pra assets de
// identidade da loja (banner_imagem_path, migration 030) - nao existe
// bucket separado pra isso ainda, sem necessidade de criar um so pra
// um arquivo por tenant.
export function urlArquivoLoja(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`
}

// logo_path null (padrao antes da Etapa 4, ou lojista nunca subiu uma
// logo propria) cai pro arquivo estatico ja usado desde a fidelidade
// ao mockup - nunca fica sem logo nenhuma.
const LOGO_PADRAO = '/brand/logocp-icone.png'

export function urlLogoLoja(logoPath: string | null): string {
  return logoPath ? urlArquivoLoja(logoPath) : LOGO_PADRAO
}
