'use client'

import { Input } from '@/components/ui/input'

const HEX = /^#[0-9a-fA-F]{6}$/

// Color picker nativo (input[type=color], exige #rrggbb sempre - por
// isso so' sincroniza pro campo de texto quando o valor digitado ja'
// bate com esse formato) + campo de texto pro hex, sincronizados nos
// dois sentidos.
export function ColorInput({
  value,
  onChange,
  id,
  'aria-invalid': ariaInvalid,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  'aria-invalid'?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={HEX.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        aria-label="Selecionar cor"
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#0891b2"
        className="font-mono uppercase"
        maxLength={7}
        aria-invalid={ariaInvalid}
      />
    </div>
  )
}
