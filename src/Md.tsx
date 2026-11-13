/** **bold** and {{r:red text}} (text that was red in the original document) */
const bold = (t: string) =>
  t.split(/(\{\{r:.*?\}\}|\*\*.+?\*\*)/g).map((x, i) =>
    x.startsWith('{{r:') ? <span key={i} className="red">{x.slice(4, -2)}</span>
      : x.startsWith('**') ? <strong key={i}>{x.slice(2, -2)}</strong> : x)

/** Plain text with markdown tables ("| a | b |" lines) rendered as real tables. */
export default function Md({ text, className }: { text: string; className?: string }) {
  const blocks: { table: boolean; lines: string[] }[] = []
  for (const l of text.split('\n')) {
    const t = l.startsWith('|')
    const last = blocks[blocks.length - 1]
    if (last && last.table === t) last.lines.push(l)
    else blocks.push({ table: t, lines: [l] })
  }
  const cells = (l: string) => l.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (!b.table || b.lines.length < 2) return <p key={i} className="md-p">{bold(b.lines.join('\n'))}</p>
        const rows = b.lines.filter((l) => !/^\|\s*:?-{3,}/.test(l)).map(cells)
        const [head, ...body] = rows
        return (
          <div key={i} className="md-wrap">
            <table className="md">
              <thead><tr>{head.map((c, j) => <th key={j}>{bold(c)}</th>)}</tr></thead>
              <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{bold(c)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
