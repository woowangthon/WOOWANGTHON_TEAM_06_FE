import { useEffect, useRef, useState } from 'react'
import { api, type Cohort, type SeniorRecord } from '../api'
import { useToast } from '../toast'

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
  const notify = useToast()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: '', event_name: '', occurred_on: '', body: '' })
  const [q, setQ] = useState('')
  const [cohortF, setCohortF] = useState(0)
  const [typeF, setTypeF] = useState('')
  const shown = list.filter((r) =>
    (!cohortF || r.cohort_id === cohortF) && (!typeF || r.type === typeF) &&
    (!q.trim() || (r.title + ' ' + r.event_name + ' ' + r.body).toLowerCase().includes(q.trim().toLowerCase())))
  const events = [...new Map(list.filter((r) => r.event_name).map((r) => [`${r.cohort_id}|${r.event_name}`, { cohort: r.cohort_id, event: r.event_name }])).values()]

  const groups = shown.reduce<Record<string, SeniorRecord[]>>((m, r) => {
    const k = `${cohorts.find((c) => c.id === r.cohort_id)?.name ?? ''} · ${r.event_name || '기타'}`
    ;(m[k] ||= []).push(r)
    return m
  }, {})

  const startEdit = () => {
    if (!detail) return
    setDraft({ title: detail.title, event_name: detail.event_name, occurred_on: detail.occurred_on, body: detail.body })
    setEditing(true)
  }
  const saveEdit = async () => {
    if (!detail) return
    try {
      const r = await api.updateRecord(detail.id, draft)
      setDetail(r); setEditing(false); load(); notify('기록을 수정했다.')
    } catch (e) { setError((e as Error).message) }
  }
  const remove = async () => {
    if (!detail || !window.confirm(`"${detail.title}" 기록을 삭제한다. 여기서 뽑은 일정과 이 일정에 남긴 결정도 함께 지워지고 되돌릴 수 없다.`)) return
    try {
      await api.deleteRecord(detail.id)
      setDetail(null); load(); notify('기록을 삭제했다.')
    } catch (e) { setError((e as Error).message) }
  }

  useEffect(() => {  // on narrow screens the sheet sits under the list: bring it into view
    if (detail && window.matchMedia('(max-width: 760px)').matches) sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [detail?.id])

  const ordered = Object.entries(groups).sort((a, b) => b[1][0].occurred_on.localeCompare(a[1][0].occurred_on))

  return (
    <section>
      {error && <p className="error" role="alert">{error}</p>}
      <AddForm cohorts={cohorts} onSaved={load} />
      <InterviewBox cohorts={cohorts} events={events} state={interview} setState={setInterview} onSaved={load} />
      <div className="filters">
        <input type="search" name="q" aria-label="기록 검색" placeholder="제목·행사·본문에서 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="기수 거르기" value={cohortF} onChange={(e) => setCohortF(+e.target.value)}>
          <option value={0}>모든 기수</option>
          {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="종류 거르기" value={typeF} onChange={(e) => setTypeF(e.target.value)}>
          <option value="">모든 종류</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="muted">{shown.length}건</span>
      </div>
      <div className="records">
        <div className="list">
          {shown.length === 0 && <p className="empty">조건에 맞는 기록이 없다.</p>}
          {ordered.map(([k, rs]) => (
            <div key={k}>
              <h3>{k}</h3>
              {rs.map((r) => (
                <button key={r.id} className={`item ${r.type === 'lesson' ? 'lesson' : ''} ${detail?.id === r.id ? 'on' : ''}`}
                  onClick={() => { setEditing(false); api.record(r.id).then(setDetail) }}>
                  <span className="d">{r.occurred_on}</span>{r.title}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div ref={sheetRef}>
          {detail ? (
            <article className="sheet">
              {editing ? (
                <div className="form" style={{ marginTop: 0 }}>
                  <input aria-label="제목" name="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  <div className="row">
                    <input className="grow" aria-label="행사명" name="event_name" placeholder="행사명" value={draft.event_name} onChange={(e) => setDraft({ ...draft, event_name: e.target.value })} />
                    <input type="date" aria-label="날짜" name="occurred_on" value={draft.occurred_on} onChange={(e) => setDraft({ ...draft, occurred_on: e.target.value })} />
                  </div>
                  <p className="muted">날짜를 바꾸면 이 기록에서 뽑은 일정도 같은 만큼 옮겨진다.</p>
                  <textarea rows={12} aria-label="본문" name="body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                  <div className="row">
                    <button className="btn primary" onClick={saveEdit}>수정 저장</button>
                    <button className="btn" onClick={() => setEditing(false)}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="tags">{detail.occurred_on} · {TYPE_LABEL[detail.type]} · {detail.event_name}</p>
                  <h2>{detail.title}</h2>
                  <p className="body">{detail.body}</p>
                  <div className="actions">
                    <button className="btn primary" onClick={() => onOpenDoc(detail.id)}>{detail.has_pdf ? '원본 문서 보기' : '크게 보기'}</button>
                    <button className="btn" onClick={startEdit}>수정</button>
                    <button className="btn danger" onClick={remove}>삭제</button>
                  </div>
                </>
              )}
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
  const notify = useToast()
  const [f, setF] = useState({ cohort_id: 0, type: 'meeting', title: '', body: '', event_name: '', occurred_on: '' })
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string | number) => setF({ ...f, [k]: v })
  const cohort = f.cohort_id || cohorts[cohorts.length - 1]?.id

  const save = async () => {
    setMsg(''); setBusy(true)
    try {
      let r
      if (file) {
        const fd = new FormData()
        fd.set('file', file); fd.set('cohort_id', String(cohort)); fd.set('type', f.type)
        fd.set('event_name', f.event_name); fd.set('title', f.title)
        if (f.occurred_on) fd.set('occurred_on', f.occurred_on)
        r = await api.upload(fd)
      } else {
        r = await api.addRecord({ ...f, cohort_id: cohort })
      }
      notify('기록을 저장했다.')
      setMsg(`저장했다. ${r.record.occurred_on} 기록에서 일정 항목 ${r.timeline_items.length}개를 뽑았다${r.extraction === 'failed' ? ' (추출 실패: 기록만 저장)' : ''}.`)
      setF({ ...f, title: '', body: '' }); setFile(null); onSaved()
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  return (
    <details className="panel">
      <summary>기록 등록</summary>
      <div className="form">
        <label className="drop">
          <span>{file ? `선택한 파일: ${file.name}` : '파일을 올리면 글자를 읽어 기록으로 저장한다 (PDF, 한글 hwp·hwpx, docx, txt)'}</span>
          <input type="file" name="file" accept=".pdf,.hwp,.hwpx,.docx,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <div className="row">
          <select aria-label="기수" name="cohort" value={cohort} onChange={(e) => set('cohort_id', +e.target.value)}>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="문서 종류" name="type" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <input type="date" aria-label="문서 날짜" name="occurred_on" value={f.occurred_on} onChange={(e) => set('occurred_on', e.target.value)} />
          {file && <span className="muted">날짜를 비우면 문서에서 찾는다</span>}
        </div>
        <input placeholder={file ? '제목 (비우면 파일 이름)' : '제목'} aria-label="제목" name="title" autoComplete="off" value={f.title} onChange={(e) => set('title', e.target.value)} />
        <input placeholder="행사명 (예: 정기총회)" aria-label="행사명" name="event_name" autoComplete="off" value={f.event_name} onChange={(e) => set('event_name', e.target.value)} />
        {!file && (
          <textarea rows={5} aria-label="본문" name="body" placeholder="파일 대신 본문을 직접 붙여 넣어도 된다. 날짜는 2025-05-02 형식으로 적는다." value={f.body}
            onChange={(e) => set('body', e.target.value)} />
        )}
        <div className="row"><button className="btn primary" onClick={save} disabled={busy}>{busy ? '읽는 중…' : '저장하고 일정 뽑기'}</button></div>
        {msg && <p className="notice" role="status">{msg}</p>}
      </div>
    </details>
  )
}

type IState = { cohort: number; event: string; question: string } | null

function InterviewBox({ cohorts, events, state, setState, onSaved }: {
  cohorts: Cohort[]; events: { cohort: number; event: string }[]; state: IState; setState: (s: IState) => void; onSaved: () => void
}) {
  const notify = useToast()
  const [cohort, setCohort] = useState(0)
  const [event, setEvent] = useState('')
  const [custom, setCustom] = useState('')
  const [answer, setAnswer] = useState('')
  const [msg, setMsg] = useState('')
  const [n, setN] = useState(0)
  const cid = cohort || cohorts[cohorts.length - 1]?.id
  const options = events.filter((e) => e.cohort === cid).map((e) => e.event)
  const chosen = custom.trim() || event || options[0] || ''

  const next = async (c: number, e: string) => {
    const r = await api.interviewNext(c, e)
    setState(r.question ? { cohort: c, event: e, question: r.question } : null)
    if (!r.question) { setMsg('질문을 모두 마쳤다. 답변이 교훈 기록으로 남았다.'); notify('인터뷰를 마쳤다. 교훈이 기록에 남았다.'); setN(0) }
  }
  const start = () => chosen && (setN(0), next(cid, chosen).catch((e) => setMsg(e.message)))
  const send = async () => {
    if (!state || !answer.trim()) return
    try {
      await api.interviewAnswer(state.cohort, state.event, state.question, answer.trim())
      setAnswer(''); setN(n + 1); onSaved(); await next(state.cohort, state.event)
    } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <details className="panel">
      <summary>퇴임 인터뷰</summary>
      <div className="form">
        {!state && (
          <>
            <p className="muted">행사를 고르면 AI 선배가 후회한 점과 다음 기수에게 남길 말을 물어본다. 답은 교훈 기록으로 저장된다.</p>
            <div className="row">
              <select aria-label="기수" name="cohort" value={cid} onChange={(e) => { setCohort(+e.target.value); setEvent('') }}>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select aria-label="인터뷰할 행사" name="event" value={event || options[0] || ''} onChange={(e) => setEvent(e.target.value)} disabled={!options.length}>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className="grow" aria-label="직접 입력한 행사명" name="event_custom" autoComplete="off" placeholder="목록에 없으면 직접 입력" value={custom} onChange={(e) => setCustom(e.target.value)} />
              <button className="btn primary" onClick={start} disabled={!chosen}>인터뷰 시작</button>
            </div>
          </>
        )}
        {state && (
          <>
            <p className="progress">{state.event} · 질문 {n + 1}/3</p>
            <p className="lead">{state.question}</p>
            <textarea rows={3} aria-label="답변" name="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <div className="row">
              <button className="btn primary" onClick={send} disabled={!answer.trim()}>답하고 다음 질문</button>
              <button className="btn" onClick={() => setState(null)}>그만하기</button>
            </div>
          </>
        )}
        {msg && <p className="notice" role="status">{msg}</p>}
      </div>
    </details>
  )
}
