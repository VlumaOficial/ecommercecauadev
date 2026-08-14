'use client'

import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftIcon, EyeIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/painel/crud/confirm-dialog'
import {
  useSalvarRascunhoVitrine,
  usePublicarVitrine,
  useGerarLinkPreview,
} from '@/hooks/use-configuracao-vitrine'
import type { ConfiguracaoVitrineCampos } from '@/lib/loja/types'
import { VitrineBannerSection } from './vitrine-banner-section'
import { VitrineSelosSection } from './vitrine-selos-section'
import { VitrineWhatsAppSection } from './vitrine-whatsapp-section'
import { VitrineIdentidadeSection } from './vitrine-identidade-section'

const HEX = /^#[0-9a-fA-F]{6}$/
const WHATSAPP = /^[0-9]{10,15}$/

const seloSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título do selo.'),
  subtitulo: z.string().trim().min(1, 'Informe o subtítulo do selo.'),
  icone: z.string().trim().min(1, 'Selecione um ícone.'),
  ativo: z.boolean(),
})

// whatsapp_numero fica como string simples no form (input nativo,
// campo vazio = ''); so' vira null (o formato "de fio", igual
// ConfiguracaoVitrineCampos) na hora de montar o payload pra API, em
// converterParaPayload() abaixo - mesmo padrao ja usado em outros
// formularios do painel pra campo opcional que vem de input de texto
// (nao dá pra um <input> nativo produzir null direto).
const vitrineSchema = z.object({
  logo_path: z.string().nullable(),
  banner_titulo: z.string().trim().min(1, 'Informe o título do banner.'),
  banner_subtitulo: z.string().trim().min(1, 'Informe o subtítulo do banner.'),
  banner_botao_texto: z.string().trim().min(1, 'Informe o texto do botão.'),
  banner_botao_href: z.string().trim().min(1, 'Informe o destino do botão.'),
  banner_tipo_fundo: z.enum(['cor', 'imagem']),
  banner_cor_fundo: z.string().regex(HEX, 'Use o formato #RRGGBB.'),
  banner_imagem_path: z.string().nullable(),
  selos: z.array(seloSchema).length(4),
  whatsapp_numero: z
    .string()
    .refine((v) => v.trim() === '' || WHATSAPP.test(v.trim()), 'Use só dígitos, DDI+DDD+número (10 a 15).'),
  whatsapp_mensagem: z.string().trim().min(1, 'Informe a mensagem pré-preenchida.'),
  cor_principal: z.string().regex(HEX, 'Use o formato #RRGGBB.'),
})

type VitrineFormValues = z.infer<typeof vitrineSchema>

function paraFormulario(campos: ConfiguracaoVitrineCampos): VitrineFormValues {
  return { ...campos, whatsapp_numero: campos.whatsapp_numero ?? '' }
}

function paraPayload(valores: VitrineFormValues): ConfiguracaoVitrineCampos {
  return { ...valores, whatsapp_numero: valores.whatsapp_numero.trim() === '' ? null : valores.whatsapp_numero.trim() }
}

export function VitrineForm({ valoresIniciais }: { valoresIniciais: ConfiguracaoVitrineCampos }) {
  const router = useRouter()
  const methods = useForm<VitrineFormValues>({
    resolver: zodResolver(vitrineSchema),
    defaultValues: paraFormulario(valoresIniciais),
  })
  const { handleSubmit } = methods

  const salvarRascunho = useSalvarRascunhoVitrine()
  const publicar = usePublicarVitrine()
  const gerarLinkPreview = useGerarLinkPreview()

  const [confirmPublicarAberto, setConfirmPublicarAberto] = useState(false)

  async function onSalvar(valores: VitrineFormValues) {
    await salvarRascunho.mutateAsync(paraPayload(valores))
  }

  async function onVisualizar(valores: VitrineFormValues) {
    await salvarRascunho.mutateAsync(paraPayload(valores))
    const url = await gerarLinkPreview.mutateAsync()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function onPedirPublicar(valores: VitrineFormValues) {
    await salvarRascunho.mutateAsync(paraPayload(valores))
    setConfirmPublicarAberto(true)
  }

  async function confirmarPublicar() {
    await publicar.mutateAsync()
    setConfirmPublicarAberto(false)
  }

  const carregando = salvarRascunho.isPending || publicar.isPending || gerarLinkPreview.isPending

  return (
    <FormProvider {...methods}>
      <form className="space-y-6 pb-24" onSubmit={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Configurações da Vitrine</h1>
            <p className="mt-1 text-muted-foreground">
              Banner, selos, WhatsApp e identidade visual da loja pública.
            </p>
          </div>
        </div>

        <VitrineBannerSection />
        <VitrineSelosSection />
        <VitrineWhatsAppSection />
        <VitrineIdentidadeSection />

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-[#f6f8fb]/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/painel')}>
              <ArrowLeftIcon />
              Voltar
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={carregando}
                onClick={handleSubmit(onSalvar)}
              >
                Salvar rascunho
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={carregando}
                onClick={handleSubmit(onVisualizar)}
              >
                <EyeIcon />
                Visualizar
              </Button>
              <Button type="button" disabled={carregando} onClick={handleSubmit(onPedirPublicar)}>
                Publicar
              </Button>
            </div>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmPublicarAberto}
        onOpenChange={setConfirmPublicarAberto}
        title="Publicar alterações?"
        description="Isto vai ao ar para os clientes agora mesmo - banner, selos, WhatsApp e identidade da vitrine pública vão mudar imediatamente."
        confirmLabel="Publicar"
        loading={publicar.isPending}
        onConfirm={confirmarPublicar}
      />
    </FormProvider>
  )
}
