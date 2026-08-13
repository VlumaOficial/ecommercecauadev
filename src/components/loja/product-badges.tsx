import { cn } from '@/lib/utils'

export function ProductBadges({
  esgotado,
  emPromocao,
  novidade,
  className,
}: {
  esgotado: boolean
  emPromocao: boolean
  novidade: boolean
  className?: string
}) {
  if (!esgotado && !emPromocao && !novidade) return null

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {emPromocao && (
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          Promoção
        </span>
      )}
      {novidade && !esgotado && (
        <span className="rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">Novidade</span>
      )}
      {esgotado && (
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">Esgotado</span>
      )}
    </div>
  )
}
