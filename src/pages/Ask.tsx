import { useState } from 'react'
import { api, type AskResult } from '../api'

export default function Ask({ onOpenRecord }: { onOpenRecord: (id: number) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<AskResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!q.trim()) return
    setBusy(true); setError('')
    try { setRes(await api.ask(q)) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  return (
    <section>
      <div className="row">
        <input className="grow" placeholder="예: 축제 부스 예산은 얼마였어?" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="primary" onClick={submit} disabled={busy}>{busy ? '찾는 중…' : '묻기'}</button>
      </div>
      {error && <p className="error">{error}</p>}
      {res && (
        <article className="card">
          <p className="answer">{res.answer}</p>
          {res.sources.length > 0 && <h3>근거 기록</h3>}
          {res.sources.map((s) => (
            <p key={s.record_id} className="source">
              <button className="link" onClick={() => onOpenRecord(s.record_id)}>{s.occurred_on} {s.title}</button>
              <br />“{s.quote}”
            </p>
          ))}
        </article>
      )}
    </section>
  )
}
