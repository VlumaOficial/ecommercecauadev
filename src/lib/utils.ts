import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarMoeda(valor: number | null): string {
  if (valor === null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Formata uma coluna `date` PURA do Postgres ("AAAA-MM-DD", eventualmente
// com sufixo) para dd/mm/aaaa, por CORTE DE STRING. Nunca usar
// `new Date("AAAA-MM-DD")` pra data pura: o JS interpreta como
// UTC-meia-noite e a exibição desloca 1 dia pra trás em fuso negativo
// (BRT). Fonte única — todo ponto que exibir data pura usa isto.
// NÃO usar em `timestamptz` (created_at, data_efetiva): essas têm
// instante real e `new Date()` é o certo.
export function formatarDataISO(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
