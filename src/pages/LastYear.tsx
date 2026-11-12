import { useEffect, useMemo, useState } from 'react'
import { api, type Card, type LastYear as Data, type SeniorRecord } from '../api'

const today = () => new Date().toISOString().slice(0, 10)
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export default function LastYear({ onOpenRecord }: { onOpenRecord: (id: number, quote?: string) => void }) {
  const [date, setDate] = useState(today())
  const [data, setData] = useState<Data | null>(null)
  const [records, setRecords] = useState<SeniorRecord[]>([])
  const [error, setError] = useState('')
  const [deciding, setDeciding] = useState<number | null>(null)

  const load = () => {
    setError('')
    api.lastYear(date).then(setData).catch((e) => setError(e.message))
  }
  useEffect(load, [date])
  useEffect(() => { api.records().then(setRecords).catch(() => {}) }, [])

  const c = data ? new Date(data.center + 'T00:00:00') : null

  return (
    <section>
      <div className="hero">
        <p className="ask">1년 전 이맘때, 우리는 무엇을 했을까</p>
        <h2 className="hero-date">
          {c ? `${c.getFullYear()}년 ${c.getMonth() + 1}월 ${c.getDate()}일` : '…'}
          {data && <small>앞뒤 {data.window_days}일</small>}
        </h2>
        <label className="picker">
          오늘로 볼 날짜 <input type="date" name="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        {data && <Ribbon center={data.center} windowDays={data.window_days} records={records} onPick={setDate} />}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {data?.notice && <p className="notice">{data.notice}</p>}
      <ol className="timeline">
        {data?.cards.map((card) => (
          <Entry key={card.id} c={card} open={deciding === card.id}
            onToggle={() => setDeciding(deciding === card.id ? null : card.id)}
            onOpenRecord={onOpenRecord} onSaved={() => { setDeciding(null); load() }} />
        ))}
      </ol>
    </section>
  )
}

function Ribbon({ center, windowDays, records, onPick }: {
  center: string; windowDays: number; records: SeniorRecord[]; onPick: (d: string) => void
}) {
  const c = new Date(center + 'T00:00:00')
  const year = c.getFullYear()
  const lo = new Date(c.getTime() - windowDays * 864e5)
  const hi = new Date(c.getTime() + windowDays * 864e5)
  const counts = useMemo(() => {
    const a = new Array(12).fill(0)
    records.forEach((r) => { if (r.type !== 'lesson' && +r.occurred_on.slice(0, 4) === year) a[+r.occurred_on.slice(5, 7) - 1]++ })
    return a
  }, [records, year])
  const max = Math.max(1, ...counts)

  return (
    <div>
      <div className="ribbon" role="group" aria-label={`${year}년 월별 기록 수. 누르면 그 달의 내년 같은 날로 이동`}>
        {counts.map((n, i) => {
          const inWin = new Date(year, i + 1, 0) >= lo && new Date(year, i, 1) <= hi
          return (
            <button key={i} className={inWin ? 'in' : ''} aria-label={`${i + 1}월 기록 ${n}건`}
              onClick={() => onPick(`${year + 1}-${String(i + 1).padStart(2, '0')}-15`)}>
              <span className="bar" style={{ height: 8 + (n / max) * 56 }} />
              {i + 1}월
            </button>
          )
        })}
      </div>
      <p className="ribbon-note">{year}년 월별 기록 수. 파란 달이 지금 보는 시기다.</p>
    </div>
  )
}

function Entry({ c, open, onToggle, onOpenRecord, onSaved }: {
  c: Card; open: boolean; onToggle: () => void; onOpenRecord: (id: number, quote?: string) => void; onSaved: () => void
}) {
  const [body, setBody] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const d = new Date(c.done_on + 'T00:00:00')

  const save = async () => {
    try {
      await api.addDecision(c.id, body, reason)
      setBody(''); setReason(''); setErr(''); onSaved()
    } catch (e) { setErr((e as Error).message) }
  }

  return (
    <li className="entry">
      <div className="when">
        {d.getMonth() + 1}.{String(d.getDate()).padStart(2, '0')}
        <span>{d.getFullYear()} · {WEEK[d.getDay()]}요일</span>
      </div>
      <div className="what">
        <h3>작년엔 이렇게 했다: {c.title}</h3>
        <p className="tags">{c.cohort_name}{c.event_name ? ` · ${c.event_name}` : ''}</p>
        {c.note && <p style={{ marginTop: 8 }}>{c.note}</p>}
        {c.lessons.map((l) => (
          <p key={l.id} className="margin-note"><b>그때 남긴 교훈</b>{l.body.length > 260 ? l.body.slice(0, 260) + "…" : l.body}</p>
        ))}
        {c.decisions.map((x) => (
          <p key={x.id} className="stamp"><b>그해 결정</b>{x.body} (이유: {x.reason})</p>
        ))}
        <div className="actions">
          <button className="btn" onClick={() => onOpenRecord(c.record_id)}>원문 보기</button>
          <button className="btn primary" onClick={onToggle} aria-expanded={open}>올해 결정 남기기</button>
        </div>
        {open && (
          <div className="form">
            <input placeholder="올해는 어떻게 할지" aria-label="올해 결정" name="decision" autoComplete="off" value={body} onChange={(e) => setBody(e.target.value)} />
            <input placeholder="이유" aria-label="결정 이유" name="reason" autoComplete="off" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="row"><button className="btn primary" onClick={save}>결정 저장</button></div>
            {err && <p className="error" role="alert">{err}</p>}
          </div>
        )}
      </div>
    </li>
  )
}
