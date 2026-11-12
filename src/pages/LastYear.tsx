import { useEffect, useState } from 'react'
import { api, type Card, type LastYear as Data } from '../api'

const today = () => new Date().toISOString().slice(0, 10)

export default function LastYear({ onOpenRecord }: { onOpenRecord: (id: number) => void }) {
  const [date, setDate] = useState(today())
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [deciding, setDeciding] = useState<number | null>(null)

  const load = () => {
    setError('')
    api.lastYear(date).then(setData).catch((e) => setError(e.message))
  }
  useEffect(load, [date])

  return (
    <section>
      <div className="row">
        <label>
          기준 날짜 <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {data && <span className="muted">비교 기준: {data.center} 앞뒤 {data.window_days}일</span>}
      </div>
      {error && <p className="error">{error}</p>}
      {data?.notice && <p className="notice">{data.notice}</p>}
      {data?.cards.map((c) => (
        <CardView key={c.id} c={c} open={deciding === c.id} onToggle={() => setDeciding(deciding === c.id ? null : c.id)}
          onOpenRecord={onOpenRecord} onSaved={() => { setDeciding(null); load() }} />
      ))}
    </section>
  )
}

function CardView({ c, open, onToggle, onOpenRecord, onSaved }: {
  c: Card; open: boolean; onToggle: () => void; onOpenRecord: (id: number) => void; onSaved: () => void
}) {
  const [body, setBody] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const save = async () => {
    try {
      await api.addDecision(c.id, body, reason)
      setBody(''); setReason(''); onSaved()
    } catch (e) { setErr((e as Error).message) }
  }

  return (
    <article className="card">
      <div className="meta">{c.done_on} · {c.cohort_name} · {c.event_name || c.category}</div>
      <h2>작년엔 이렇게 했다: {c.title}</h2>
      {c.note && <p>{c.note}</p>}
      {c.lessons.map((l) => (
        <p key={l.id} className="lesson">💬 교훈: {l.body}</p>
      ))}
      {c.decisions.map((d) => (
        <p key={d.id} className="decision">✅ 그해 결정: {d.body} <span className="muted">(이유: {d.reason})</span></p>
      ))}
      <div className="row">
        <button onClick={() => onOpenRecord(c.record_id)}>원문 보기</button>
        <button className="primary" onClick={onToggle}>올해 결정 남기기</button>
      </div>
      {open && (
        <div className="form">
          <input placeholder="올해는 어떻게 할지" value={body} onChange={(e) => setBody(e.target.value)} />
          <input placeholder="이유" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="primary" onClick={save}>저장</button>
          {err && <p className="error">{err}</p>}
        </div>
      )}
    </article>
  )
}
