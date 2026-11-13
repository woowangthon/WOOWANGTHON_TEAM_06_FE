import { useEffect, useState } from 'react'
import { api, type DecisionRow } from '../api'

export default function Decisions({ onOpenDoc, goLast }: { onOpenDoc: (id: number) => void; goLast: () => void }) {
  const [rows, setRows] = useState<DecisionRow[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api.decisions().then(setRows).catch((e) => setError(e.message)) }, [])

  const byYear = (rows ?? []).reduce<Record<string, DecisionRow[]>>((m, r) => {
    ;(m[r.decided_on.slice(0, 4)] ||= []).push(r)
    return m
  }, {})

  return (
    <section>
      <h2 className="ask-h">우리가 내린 결정은<br />다음 기수의 근거가 됩니다</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {rows && rows.length === 0 && (
        <div className="empty">
          <p>아직 남긴 결정이 없습니다.</p>
          <p style={{ marginTop: 10 }}><button className="btn primary" onClick={goLast}>작년 이맘때에서 결정 남기기</button></p>
        </div>
      )}
      {Object.entries(byYear).map(([year, list]) => (
        <div key={year} style={{ marginTop: 28 }}>
          <h3 className="year">{year}년 결정 · {list.length}건</h3>
          <ol className="timeline" style={{ marginTop: 8 }}>
            {list.map((d) => (
              <li key={d.id} className="entry">
                <div className="when">{d.decided_on.slice(5).replace('-', '.')}<span>{d.cohort_name}</span></div>
                <div className="what">
                  <h3>{d.body}</h3>
                  <p className="tags">{d.event_name || '행사'} · 근거 문서: {d.item_title}</p>
                  <p style={{ marginTop: 8 }}><b>이유</b> {d.reason}</p>
                  <div className="actions"><button className="btn" onClick={() => onOpenDoc(d.record_id)}>근거 문서 보기</button></div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}
