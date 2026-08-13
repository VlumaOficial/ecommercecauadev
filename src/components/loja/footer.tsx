import Image from 'next/image'
import Link from 'next/link'

const COLUNAS: { titulo: string; itens: { label: string; href?: string }[] }[] = [
  {
    titulo: 'Loja',
    itens: [
      { label: 'Todas as categorias', href: '/produtos' },
      { label: 'Promoções', href: '/produtos?promocao=1' },
      { label: 'Novidades', href: '/produtos?ordenar=novidade' },
    ],
  },
  {
    titulo: 'Ajuda',
    itens: [{ label: 'Como comprar' }, { label: 'Entrega por cidade' }, { label: 'Fale conosco' }],
  },
  {
    titulo: 'Sobre',
    itens: [{ label: 'O criatório' }, { label: 'Política de privacidade' }, { label: 'Termos de uso' }],
  },
]

export function Footer({ nomeLoja }: { nomeLoja: string }) {
  return (
    <footer className="mt-12 bg-[#0f172a] pt-10 pb-6 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 pb-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <p className="mb-2.5 flex items-center gap-2.5 font-display text-lg font-extrabold text-primary">
              <Image src="/brand/logocp-icone.png" alt="" width={50} height={40} className="h-10 w-auto" />
              {nomeLoja}
            </p>
            <p className="max-w-xs text-[13px] leading-relaxed text-slate-400">
              Peixes ornamentais de criação própria. Qualidade e saúde direto do criatório para o seu aquário.
            </p>
          </div>
          {COLUNAS.map((col) => (
            <div key={col.titulo}>
              <h4 className="mb-3.5 text-sm font-semibold text-white">{col.titulo}</h4>
              <div className="flex flex-col">
                {col.itens.map((item) =>
                  item.href ? (
                    <Link key={item.label} href={item.href} className="py-1 text-[13px] text-slate-400 hover:text-white">
                      {item.label}
                    </Link>
                  ) : (
                    <span key={item.label} className="py-1 text-[13px] text-slate-400">
                      {item.label}
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {nomeLoja} · Peixes ornamentais · Uma loja VLUMA
        </p>
      </div>
    </footer>
  )
}
