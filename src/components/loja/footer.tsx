export function Footer({ nomeLoja }: { nomeLoja: string }) {
  return (
    <footer className="mt-12 border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p className="font-display text-base font-bold text-primary">{nomeLoja}</p>
        <p className="mt-1 max-w-md">
          Peixes ornamentais e itens para aquarismo, com retirada combinada por cidade de entrega.
        </p>
        <p className="mt-6 text-xs text-muted-foreground/80">
          © {new Date().getFullYear()} {nomeLoja}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
