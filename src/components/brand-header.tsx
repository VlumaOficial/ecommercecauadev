import Image from 'next/image'

const SIMBOLO =
  'https://embgxkrfwtbqfkwmquvo.supabase.co/storage/v1/object/public/assets/capua-simbolo.png'

export function BrandHeader({ size = 92 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center">
      <Image
        src={SIMBOLO}
        alt="Criatório Capuã"
        width={size}
        height={Math.round(size * 0.81)}
        priority
      />
      <h1 className="mt-4 font-display text-2xl font-bold tracking-[0.2em] text-[var(--brand-navy)]">
        CRIATÓRIO
      </h1>
      <p className="text-sm font-bold tracking-[0.4em] text-[var(--brand-red)]">
        CAPUÃ
      </p>
    </div>
  )
}
