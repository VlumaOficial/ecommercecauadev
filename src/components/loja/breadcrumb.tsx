import Link from 'next/link'
import { ChevronRightIcon } from 'lucide-react'

export function Breadcrumb({ itens }: { itens: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-foreground">
        Início
      </Link>
      {itens.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRightIcon className="size-3.5 shrink-0" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
