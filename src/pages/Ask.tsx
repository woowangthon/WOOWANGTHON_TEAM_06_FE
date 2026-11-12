import { useState } from 'react'
import { api, type AskResult } from '../api'

const EXAMPLES = ['MT 때 시간이 왜 밀렸어?', '정기총회는 어떻게 준비했어?', 'LT 레크는 뭘 했어?']

export default function Ask({ onOpenRecord }: { onOpenRecord: (id: number, quote?: string) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<AskResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (text = q) => {
    if (!text.trim()) return
    setQ(text); setBusy(true); setError('')
    try { setRes(await api.ask(text)) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  const lead = res && (res.sources.length ? res.answer.split('\n')[0] : res.answer)

  return (
    <section>
      <h2 className="ask-h">지난 기수 기록에서<br />찾아서 알려줄게</h2>
      <div className="ask-box">
        <input placeholder="예: MT 때 시간이 왜 밀렸어?" aria-label="질문" name="question" autoComplete="off" enterKeyHint="search" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="btn primary" onClick={() => submit()} disabled={busy}>{busy ? '찾는 중…' : '묻기'}</button>
      </div>
      <div className="chips">
        {EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => submit(x)}>{x}</button>)}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {res && (
        <div className="answer" aria-live="polite">
          <p className="lead">{lead}</p>
          {res.sources.map((s) => (
            <div key={s.record_id} className="src">
              <p className="src-meta">
                근거 기록 · <button className="link" onClick={() => onOpenRecord(s.record_id, s.quote)}>{s.occurred_on} {s.title}</button>
              </p>
              <p className="quote"><mark>{s.quote}</mark></p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
