import {
  TruckIcon,
  ShieldCheckIcon,
  HeadsetIcon,
  FishIcon,
  LeafIcon,
  SproutIcon,
  PackageIcon,
  HeartIcon,
  StarIcon,
  type LucideIcon,
} from 'lucide-react'

// Lista pre-definida de icones pros selos de confianca (migration 030
// - store_settings.selos, campo `icone` guarda a CHAVE, nunca o
// componente). Compartilhada entre a vitrine publica
// (selos-confianca.tsx, chave -> icone padrao se desconhecida) e o
// seletor da tela de Configuracoes da Vitrine (Etapa 4) - fonte unica
// pras duas pontas nunca ficarem fora de sincronia.
export const ICONES_SELO: Record<string, LucideIcon> = {
  truck: TruckIcon,
  'shield-check': ShieldCheckIcon,
  headset: HeadsetIcon,
  fish: FishIcon,
  leaf: LeafIcon,
  sprout: SproutIcon,
  package: PackageIcon,
  heart: HeartIcon,
  star: StarIcon,
}

export const OPCOES_ICONE_SELO: { valor: string; rotulo: string; icone: LucideIcon }[] = [
  { valor: 'truck', rotulo: 'Caminhão', icone: TruckIcon },
  { valor: 'shield-check', rotulo: 'Escudo', icone: ShieldCheckIcon },
  { valor: 'headset', rotulo: 'Atendimento', icone: HeadsetIcon },
  { valor: 'fish', rotulo: 'Peixe', icone: FishIcon },
  { valor: 'leaf', rotulo: 'Folha', icone: LeafIcon },
  { valor: 'sprout', rotulo: 'Broto', icone: SproutIcon },
  { valor: 'package', rotulo: 'Pacote', icone: PackageIcon },
  { valor: 'heart', rotulo: 'Coração', icone: HeartIcon },
  { valor: 'star', rotulo: 'Estrela', icone: StarIcon },
]
