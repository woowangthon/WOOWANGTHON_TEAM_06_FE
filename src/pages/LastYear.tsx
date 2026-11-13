import { useEffect, useMemo, useState } from 'react'
import { api, type Card, type Decision, type DecisionRow, type Lesson, type LastYear as Data, type SeniorRecord } from '../api'
import { useToast } from '../toast'

const today = () => new Date().toISOString().slice(0, 10)
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const md = (iso: string) => `${+iso.slice(5, 7)}.${iso.slice(8, 10)}`

type Group = { key: string; event: string; cohort: string; cards: Card[]; lessons: Lesson[]; decisions: Decision[] }

function group(cards: Card[]): Group[] {
  const m = new Map<string, Group>()
  for (const c of cards) {
    const key = `${c.cohort_id}|${c.event_name || c.record_title}`
    const g = m.get(key) ?? { key, event: c.event_name || c.record_title, cohort: c.cohort_name, cards: [], lessons: [], decisions: [] }
    g.cards.push(c)
    c.lessons.forEach((l) => g.lessons.some((x) => x.id === l.id) || g.lessons.push(l))
    c.decisions.forEach((d) => g.decisions.some((x) => x.id === d.id) || g.decisions.push(d))
    m.set(key, g)
  }
  return [...m.values()]
}

export default function LastYear({ onOpenRecord }: { onOpenRecord: (id: number, quote?: string) => void }) {
  const [date, setDate] = useState(today())
  const [data, setData] = useState<Data | null>(null)
  const [records, setRecords] = useState<SeniorRecord[]>([])
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [error, setError] = useState('')
  const [deciding, setDeciding] = useState<string | null>(null)
  const notify = useToast()

  const load = () => {
    setError('')
    api.lastYear(date).then(setData).catch((e) => setError(e.message))
  }
  useEffect(load, [date])
  useEffect(() => {
    api.records().then(setRecords).catch(() => {})
    api.decisions().then(setDecisions).catch(() => {})
  }, [])

  const groups = useMemo(() => (data ? group(data.cards) : []), [data])
  const c = data ? new Date(data.center + 'T00:00:00') : null
  const events = new Set(records.map((r) => r.event_name).filter(Boolean)).size

  return (
    <section>
      <div className="hero">
        <p className="ask">1년 전 이맘때, 우리는 무엇을 했을까요?</p>
        <h2 className="hero-date">
          {c ? `${c.getFullYear()}년 ${c.getMonth() + 1}월 ${c.getDate()}일` : '…'}
          {data && <small>앞뒤 {data.window_days}일</small>}
        </h2>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label className="picker">
            오늘로 볼 날짜 <input type="date" name="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <dl className="stats" aria-label="쌓인 기록">
            <div><dt>기록</dt><dd>{records.length}</dd></div>
            <div><dt>행사</dt><dd>{events}</dd></div>
            <div><dt>교훈</dt><dd>{records.filter((r) => r.type === 'lesson').length}</dd></div>
            <div><dt>결정</dt><dd>{decisions.length}</dd></div>
          </dl>
        </div>
        {data && <Ribbon center={data.center} windowDays={data.window_days} records={records} onPick={setDate} />}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && <div className="skeleton" aria-hidden="true"><i /><i /><i /></div>}
      {data?.notice && <p className="notice">{data.notice}</p>}
      <ol className="timeline">
        {groups.map((g) => (
          <Entry key={g.key} g={g} open={deciding === g.key}
            onToggle={() => setDeciding(deciding === g.key ? null : g.key)}
            onOpenRecord={onOpenRecord}
            onSaved={() => { setDeciding(null); load(); api.decisions().then(setDecisions).catch(() => {}); notify('결정을 남겼습니다. 다음 기수가 이 카드에서 볼 수 있습니다.') }} />
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
      <p className="ribbon-note">{year}년 월별 기록 수입니다. 파란 달이 지금 보는 시기이며, 달을 누르면 그 시기로 이동합니다.</p>
    </div>
  )
}

function Entry({ g, open, onToggle, onOpenRecord, onSaved }: {
  g: Group; open: boolean; onToggle: () => void; onOpenRecord: (id: number, quote?: string) => void; onSaved: () => void
}) {
  const [body, setBody] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [allLessons, setAllLessons] = useState(false)
  const first = g.cards[0]
  const last = g.cards[g.cards.length - 1]
  const d = new Date(first.done_on + 'T00:00:00')
  const lessons = allLessons ? g.lessons : g.lessons.slice(0, 2)

  const save = async () => {
    try {
      await api.addDecision(first.id, body, reason)
      setBody(''); setReason(''); setErr(''); onSaved()
    } catch (e) { setErr((e as Error).message) }
  }

  return (
    <li className="entry">
      <div className="when">
        {md(first.done_on)}
        <span>{d.getFullYear()} · {WEEK[d.getDay()]}요일{last.done_on !== first.done_on ? ` · ~${md(last.done_on)}` : ''}</span>
      </div>
      <div className="what">
        <h3>작년에는 이렇게 했습니다: {g.event}</h3>
        <p className="tags">{g.cohort} · 문서 {g.cards.length}건</p>
        <ul className="docs">
          {g.cards.map((c) => (
            <li key={c.id}>
              <span className="muted">{md(c.done_on)}</span>{' '}
              <button className="link" onClick={() => onOpenRecord(c.record_id)}>{c.title}</button>
              {c.note && <span className="muted"> — {c.note}</span>}
            </li>
          ))}
        </ul>
        {lessons.map((l) =>
          l.body.length > 300 ? (
            <p key={l.id} className="margin-note"><b>그때 남긴 평가 기록</b>
              <button className="link" onClick={() => onOpenRecord(l.id)}>{l.title}</button> 평가회의에서 나온 후기와 개선점이 담겨 있습니다.
            </p>
          ) : (
            <p key={l.id} className="margin-note"><b>그때 남긴 교훈 · {l.title}</b>{l.body}</p>
          ))}
        {g.lessons.length > 2 && (
          <button className="link" onClick={() => setAllLessons(!allLessons)}>{allLessons ? '교훈 접기' : `교훈 ${g.lessons.length - 2}건 더 보기`}</button>
        )}
        {g.decisions.map((x) => (
          <p key={x.id} className="stamp"><b>그해 결정 · {x.decided_on}</b>{x.body} (이유: {x.reason})</p>
        ))}
        <div className="actions">
          <button className="btn primary" onClick={onToggle} aria-expanded={open}>올해 결정 남기기</button>
        </div>
        {open && (
          <div className="form">
            <input placeholder="올해는 어떻게 할지 적어 주세요" aria-label="올해 결정" name="decision" autoComplete="off" value={body} onChange={(e) => setBody(e.target.value)} />
            <input placeholder="이유를 적어 주세요" aria-label="결정 이유" name="reason" autoComplete="off" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="row"><button className="btn primary" onClick={save}>결정 저장</button></div>
            {err && <p className="error" role="alert">{err}</p>}
          </div>
        )}
      </div>
    </li>
  )
}
