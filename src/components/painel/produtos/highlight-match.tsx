// Destaca o trecho de "text" que bateu com "query" (case-insensitive,
// substring simples - mesmo criterio do ILIKE usado na busca do
// servidor). Sem match, devolve o texto puro.
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  const termo = query.trim()
  if (!termo) return <>{text}</>

  const idx = text.toLowerCase().indexOf(termo.toLowerCase())
  if (idx === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-900/60">
        {text.slice(idx, idx + termo.length)}
      </mark>
      {text.slice(idx + termo.length)}
    </>
  )
}
