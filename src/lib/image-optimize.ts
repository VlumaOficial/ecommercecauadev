// Otimizacao client-side de imagem de produto (Produtos Etapa 3),
// decisao de produto: comprimir no navegador antes do upload, sem
// depender de Image Transformation do Supabase (recurso pago, fora do
// plano atual do projeto) nem de Edge Function dedicada.

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']
// Limite generoso pro ARQUIVO ORIGINAL antes de comprimir (foto de
// celular sem compressao pode passar de 10MB facil) - o limite real de
// 5MB (client + servidor + bucket) vale pro resultado JA comprimido.
const TAMANHO_MAXIMO_ENTRADA = 20 * 1024 * 1024

export function validarArquivoImagem(file: File): string | null {
  if (!TIPOS_ACEITOS.includes(file.type)) {
    return 'Formato não suportado. Use JPG, PNG ou WebP.'
  }
  if (file.size > TAMANHO_MAXIMO_ENTRADA) {
    return 'Arquivo muito grande (máximo 20MB antes da otimização).'
  }
  return null
}

// Redimensiona pro maior lado nao passar de maxDimensao e reencoda
// sempre como WebP (independente do formato de entrada) - decisao de
// produto: normaliza pra um formato so no Storage, com boa compressao.
export async function comprimirImagemParaWebp(
  file: File,
  maxDimensao = 1600,
  qualidade = 0.8
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const escala = Math.min(1, maxDimensao / Math.max(bitmap.width, bitmap.height))
    const largura = Math.max(1, Math.round(bitmap.width * escala))
    const altura = Math.max(1, Math.round(bitmap.height * escala))

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.')
    ctx.drawImage(bitmap, 0, 0, largura, altura)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Não foi possível gerar a imagem otimizada.'))
        },
        'image/webp',
        qualidade
      )
    })
  } finally {
    bitmap.close()
  }
}
