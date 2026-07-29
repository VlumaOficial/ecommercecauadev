'use client'

import { useEffect, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function SearchInput({
  defaultValue,
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 400,
  className,
}: {
  defaultValue: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}) {
  const [texto, setTexto] = useState(defaultValue)

  // Mantem sincronizado quando o valor muda por fora (ex.: botao voltar do navegador)
  useEffect(() => {
    setTexto(defaultValue)
  }, [defaultValue])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (texto !== defaultValue) onChange(texto)
    }, debounceMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  )
}
