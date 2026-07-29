import { Badge } from '@/components/ui/badge'

export function StatusBadge({ ativo }: { ativo: boolean }) {
  if (ativo) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
      >
        Ativo
      </Badge>
    )
  }
  return <Badge variant="secondary">Inativo</Badge>
}
