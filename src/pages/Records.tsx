import { useEffect, useState } from 'react'
import { api, type Cohort, type SeniorRecord } from '../api'

const TYPES = ['meeting', 'event'] as const
const TYPE_LABEL: Record<string, string> = { meeting: '회의록', event: '행사 문서', lesson: '교훈', decision: '결정' }

export default function Records({ onOpenDoc }: { onOpenDoc: (id: number, quote?: string) => void }) {
  const [list, setList] = useState<SeniorRecord[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [detail, setDetail] = useState<SeniorRecord | null>(null)
  const [error, setError] = useState('')
  const [interview, setInterview] = useState<{ cohort: number; event: string; question: string } | null>(null)

  const load = () => {
    api.records().then(setList).catch((e) => setError(e.message))
    api.cohorts().then(setCohorts).catch(() => {})
  }
  useEffect(load, [])
  const groups = list.reduce<Record<string, SeniorRecord[]>>((m, r) => {
    const k = `${cohorts.find((c) => c.id === r.cohort_id)?.name ?? ''} · ${r.event_name || '기타'}`
    ;(m[k] ||= []).push(r)
    return m
  }, {})

  return (
    <section>
      {error && <p className="error" role="alert">{error}</p>}
      <AddForm cohorts={cohorts} onSaved={load} />
      <InterviewBox cohorts={cohorts} state={interview} setState={setInterview} onSaved={load} />
      <div className="records">
        <div className="list">
          {Object.entries(groups).map(([k, rs]) => (
            <div key={k}>
              <h3>{k}</h3>
              {rs.map((r) => (
                <button key={r.id} className={`item ${r.type === 'lesson' ? 'lesson' : ''} ${detail?.id === r.id ? 'on' : ''}`}
                  onClick={() => api.record(r.id).then(setDetail)}>
                  <span className="d">{r.occurred_on}</span>{r.title}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div>
          {detail ? (
            <article className="sheet">
              <p className="tags">{detail.occurred_on} · {TYPE_LABEL[detail.type]} · {detail.event_name}</p>
              <h2>{detail.title}</h2>
              <p className="body">{detail.body}</p>
              <div className="actions"><button className="btn primary" onClick={() => onOpenDoc(detail.id)}>{detail.has_pdf ? '원본 문서 보기' : '크게 보기'}</button></div>
            </article>
          ) : (
            <p className="empty">왼쪽에서 기록을 고르면 원문이 여기에 열린다.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function AddForm({ cohorts, onSaved }: { cohorts: Cohort[]; onSaved: () => void }) {
  const [f, setF] = useState({ cohort_id: 0, type: 'meeting', title: '', body: '', event_name: '', occurred_on: '' })
  const [msg, setMsg] = useState('')
  const set = (k: string, v: string | number) => setF({ ...f, [k]: v })

  const save = async () => {
    setMsg('')
    try {
      const r = await api.addRecord({ ...f, cohort_id: f.cohort_id || cohorts[cohorts.length - 1]?.id })
      setMsg(`저장했다. 일정 항목 ${r.timeline_items.length}개를 뽑았다${r.extraction === 'failed' ? ' (추출 실패: 기록만 저장)' : ''}.`)
      setF({ ...f, title: '', body: '' }); onSaved()
    } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <details className="panel">
      <summary>기록 등록</summary>
      <div className="form">
        <div className="row">
          <select aria-label="기수" name="cohort" value={f.cohort_id} onChange={(e) => set('cohort_id', +e.target.value)}>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="문서 종류" name="type" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <input type="date" aria-label="문서 날짜" name="occurred_on" value={f.occurred_on} onChange={(e) => set('occurred_on', e.target.value)} />
        </div>
        <input placeholder="제목" aria-label="제목" name="title" autoComplete="off" value={f.title} onChange={(e) => set('title', e.target.value)} />
        <input placeholder="행사명 (예: 봄 축제 부스)" aria-label="행사명" name="event_name" autoComplete="off" value={f.event_name} onChange={(e) => set('event_name', e.target.value)} />
        <textarea rows={5} aria-label="본문" name="body" placeholder="본문 (날짜는 2025-05-02 형식으로 적으면 일정으로 뽑힌다)" value={f.body}
          onChange={(e) => set('body', e.target.value)} />
        <button className="btn primary" onClick={save}>저장하고 일정 뽑기</button>
        {msg && <p className="notice" role="status">{msg}</p>}
      </div>
    </details>
  )
}

type IState = { cohort: number; event: string; question: string } | null

function InterviewBox({ cohorts, state, setState, onSaved }: {
  cohorts: Cohort[]; state: IState; setState: (s: IState) => void; onSaved: () => void
}) {
  const [cohort, setCohort] = useState(0)
  const [event, setEvent] = useState('')
  const [answer, setAnswer] = useState('')
  const [msg, setMsg] = useState('')
  const cid = cohort || cohorts[cohorts.length - 1]?.id

  const next = async (c: number, e: string) => {
    const r = await api.interviewNext(c, e)
    setState(r.question ? { cohort: c, event: e, question: r.question } : null)
    setMsg(r.question ? '' : '질문을 모두 마쳤다. 교훈이 기록으로 남았다.')
  }
  const start = () => event.trim() && next(cid, event.trim()).catch((e) => setMsg(e.message))
  const send = async () => {
    if (!state || !answer.trim()) return
    try {
      await api.interviewAnswer(state.cohort, state.event, state.question, answer.trim())
      setAnswer(''); onSaved(); await next(state.cohort, state.event)
    } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <details className="panel">
      <summary>퇴임 인터뷰</summary>
      <div className="form">
        {!state && (
          <div className="row">
            <select aria-label="기수" name="cohort" value={cid} onChange={(e) => setCohort(+e.target.value)}>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="grow" aria-label="인터뷰할 행사명" name="event" autoComplete="off" placeholder="인터뷰할 행사명 (예: 송년회)" value={event} onChange={(e) => setEvent(e.target.value)} />
            <button className="btn primary" onClick={start}>인터뷰 시작</button>
          </div>
        )}
        {state && (
          <>
            <p className="lead">{state.question}</p>
            <textarea rows={3} aria-label="답변" name="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <button className="btn primary" onClick={send}>답하고 다음 질문</button>
          </>
        )}
        {msg && <p className="notice" role="status">{msg}</p>}
      </div>
    </details>
  )
}
