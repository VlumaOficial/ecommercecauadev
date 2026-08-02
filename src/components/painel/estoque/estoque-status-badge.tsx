import { Badge } from '@/components/ui/badge'
import type { StatusEstoque } from '@/hooks/use-estoque'

export function EstoqueStatusBadge({ status }: { status: StatusEstoque }) {
  if (status === 'ok') {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
      >
        OK
      </Badge>
    )
  }
  if (status === 'abaixo_do_minimo') {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
      >
        Abaixo do mínimo
      </Badge>
    )
  }
  return <Badge variant="destructive">Esgotado</Badge>
}
