'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SearchIcon } from 'lucide-react'

export function SearchForm({ className }: { className?: string }) {
  const router = useRouter()
  const [termo, setTermo] = useState('')

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        const q = termo.trim()
        router.push(q ? `/produtos?q=${encodeURIComponent(q)}` : '/produtos')
      }}
    >
      <div className="flex h-9 w-full items-center gap-2 rounded-full border border-border bg-background px-3 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar produtos..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </form>
  )
}
