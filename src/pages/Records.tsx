import { useEffect, useRef, useState } from 'react'
import { api, type Cohort, type SeniorRecord, type TableHit } from '../api'
import Md from '../Md'
import { useToast } from '../toast'
import SideSlot from '../SideSlot'

const TYPES = ['meeting', 'event'] as const
const TYPE_LABEL: Record<string, string> = { meeting: '회의록', event: '행사 문서', lesson: '교훈', decision: '결정' }

export default function Records({ onOpenDoc, search, registerTick }: { onOpenDoc: (id: number, quote?: string) => void; search: string; registerTick: number }) {
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
  const [addOpen, setAddOpen] = useState(false)
  const [tableHits, setTableHits] = useState<TableHit[]>([])
  const addRef = useRef<HTMLDivElement>(null)
  const q = search
  useEffect(() => {  // tables (timetables, schedules...) that match the search show up right away
    if (!search.trim()) { setTableHits([]); return }
    const t = window.setTimeout(() => api.tables(search.trim()).then(setTableHits).catch(() => setTableHits([])), 250)
    return () => window.clearTimeout(t)
  }, [search])
  useEffect(() => {
    if (registerTick > 0) { setAddOpen(true); addRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  }, [registerTick])
  const [cohortF, setCohortF] = useState(0)
  const [typeF, setTypeF] = useState('')
  const words = q.toLowerCase().split(/\s+/).filter((w) => w && !['타임테이블', '시간표', '일정표', '스케줄'].includes(w))
  const shown = list.filter((r) =>
    (!cohortF || r.cohort_id === cohortF) && (!typeF || r.type === typeF) &&
    words.every((w) => (r.title + ' ' + r.event_name + ' ' + r.body).toLowerCase().includes(w)))
  const events = [...new Map(list.filter((r) => r.event_name).map((r) => [`${r.cohort_id}|${r.event_name}`, { cohort: r.cohort_id, event: r.event_name }])).values()]

  const startEdit = () => {
    if (!detail) return
    setDraft({ title: detail.title, event_name: detail.event_name, occurred_on: detail.occurred_on, body: detail.body })
    setEditing(true)
  }
  const saveEdit = async () => {
    if (!detail) return
    try {
      const r = await api.updateRecord(detail.id, draft)
      setDetail(r); setEditing(false); load(); notify('기록을 수정했습니다.')
    } catch (e) { setError((e as Error).message) }
  }
  const remove = async () => {
    if (!detail || !window.confirm(`"${detail.title}" 기록을 삭제합니다. 여기서 뽑은 일정과 이 일정에 남긴 결정도 함께 지워지며 되돌릴 수 없습니다.`)) return
    try {
      await api.deleteRecord(detail.id)
      setDetail(null); load(); notify('기록을 삭제했습니다.')
    } catch (e) { setError((e as Error).message) }
  }

  useEffect(() => {  // on narrow screens the sheet sits under the list: bring it into view
    if (detail && window.matchMedia('(max-width: 760px)').matches) sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [detail?.id])

  return (
    <section>
      {error && <p className="error" role="alert">{error}</p>}
      <div ref={addRef}><AddForm cohorts={cohorts} onSaved={load} open={addOpen} onToggle={setAddOpen} /></div>
      <InterviewBox cohorts={cohorts} events={events} state={interview} setState={setInterview} onSaved={load} />
      <SideSlot>
        <div className="side-block">
          <label className="side-label" htmlFor="rec-cohort">기수</label>
          <select id="rec-cohort" value={cohortF} onChange={(e) => setCohortF(+e.target.value)}>
            <option value={0}>모든 기수</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="side-block">
          <label className="side-label" htmlFor="rec-type">종류</label>
          <select id="rec-type" value={typeF} onChange={(e) => setTypeF(e.target.value)}>
            <option value="">모든 종류</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <p className="side-count">조건에 맞는 기록 {shown.length}건</p>
      </SideSlot>
      {tableHits.length > 0 && (
        <div className="table-hits">
          <h2>표 · 타임테이블 <b>{tableHits.length}</b></h2>
          {tableHits.map((h, i) => (
            <article key={h.record_id + ':' + i} className="tcard">
              <header>
                <span className="tagchip">{h.event_name || '기타'}</span>
                <strong>{h.title}</strong>
                <span className="muted">{h.occurred_on}{h.caption ? ` · ${h.caption}` : ''}</span>
                <button className="btn" onClick={() => onOpenDoc(h.record_id)}>{h.has_pdf ? '원본 확인하기' : '원문 보기'}</button>
              </header>
              <Md text={h.table} />
            </article>
          ))}
        </div>
      )}
      <div className={`records ${detail ? 'with-detail' : ''}`}>
        <div className="mail-list">
          <div className="mail-toolbar">
            <h2>기록 <b>{shown.length}</b></h2>
            {q && <span className="muted">“{q}” 검색 결과</span>}
          </div>
          <div className="mail-head" aria-hidden="true"><span>날짜</span><span>행사</span><span>제목</span><span>종류</span></div>
          {shown.length === 0 && <p className="empty">조건에 맞는 기록이 없습니다.</p>}
          {[...shown].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id - a.id).map((r) => (
            <button key={r.id} className={`mail-row ${detail?.id === r.id ? 'on' : ''}`}
              onClick={() => { setEditing(false); api.record(r.id).then(setDetail) }}>
              <span className="c-date">{r.occurred_on}</span>
              <span className="c-event"><i className="tagchip">{r.event_name || '기타'}</i></span>
              <span className="c-title">{r.title}{r.has_pdf && <svg className="clip" viewBox="0 0 24 24" aria-label="원본 문서 있음"><path d="M21 12.5l-8.6 8.6a5 5 0 01-7.1-7.1l9-9a3.3 3.3 0 014.7 4.7l-9 9a1.7 1.7 0 01-2.4-2.4l8.3-8.3" /></svg>}</span>
              <span className="c-type"><i className={`type ${r.type}`}>{TYPE_LABEL[r.type]}</i></span>
            </button>
          ))}
        </div>
        <div ref={sheetRef}>
          {detail && (
            <article className="sheet">
              {editing ? (
                <div className="form" style={{ marginTop: 0 }}>
                  <input aria-label="제목" name="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  <div className="row">
                    <input className="grow" aria-label="행사명" name="event_name" placeholder="행사명" value={draft.event_name} onChange={(e) => setDraft({ ...draft, event_name: e.target.value })} />
                    <input type="date" aria-label="날짜" name="occurred_on" value={draft.occurred_on} onChange={(e) => setDraft({ ...draft, occurred_on: e.target.value })} />
                  </div>
                  <p className="muted">날짜를 바꾸면 이 기록에서 뽑은 일정도 같은 만큼 옮겨집니다.</p>
                  <textarea rows={12} aria-label="본문" name="body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                  <div className="row">
                    <button className="btn primary" onClick={saveEdit}>수정 저장</button>
                    <button className="btn" onClick={() => setEditing(false)}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <button className="btn close" onClick={() => setDetail(null)} aria-label="닫기">닫기</button>
                  <p className="tags">{detail.occurred_on} · {TYPE_LABEL[detail.type]} · {detail.event_name}</p>
                  <h2>{detail.title}</h2>
                  {detail.has_pdf && (
                    <button className="preview" onClick={() => onOpenDoc(detail.id)}>
                      원본 확인하기
                    </button>
                  )}
                  <Md className="body" text={detail.body} />
                  <div className="actions">
                    <button className="btn primary" onClick={() => onOpenDoc(detail.id)}>{detail.has_pdf ? '원본 문서 보기' : '크게 보기'}</button>
                    <button className="btn" onClick={startEdit}>수정</button>
                    <button className="btn danger" onClick={remove}>삭제</button>
                  </div>
                </>
              )}
            </article>
          )}
        </div>
      </div>
    </section>
  )
}

function AddForm({ cohorts, onSaved, open, onToggle }: { cohorts: Cohort[]; onSaved: () => void; open: boolean; onToggle: (o: boolean) => void }) {
  const notify = useToast()
  const [f, setF] = useState({ cohort_id: 0, type: 'meeting', title: '', body: '', event_name: '', occurred_on: '' })
  const [files, setFiles] = useState<File[]>([])
  const [msg, setMsg] = useState('')
  const [failures, setFailures] = useState<string[]>([])
  const [progress, setProgress] = useState('')
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const set = (k: string, v: string | number) => setF({ ...f, [k]: v })
  const cohort = f.cohort_id || cohorts[cohorts.length - 1]?.id
  const many = files.length > 1

  const addFiles = (list: FileList | null) => setFiles(list ? Array.from(list) : [])

  const save = async () => {
    setMsg(''); setFailures([]); setBusy(true)
    try {
      if (!files.length) {
        const r = await api.addRecord({ ...f, cohort_id: cohort })
        notify('기록을 업로드했습니다.')
        setMsg(`업로드했습니다. 구간 ${r.passages}개를 색인했고, ${r.record.occurred_on} 기록에서 일정 항목 ${r.timeline_items.length}개를 뽑았습니다${r.extraction === 'failed' ? ' (일정 추출에 실패해 기록만 보관했습니다)' : ''}.`)
        setF({ ...f, title: '', body: '' })
      } else {
        let ok = 0, items = 0, passages = 0
        const bad: string[] = []
        for (const [i, file] of files.entries()) {
          setProgress(`${i + 1}/${files.length} 텍스트 추출 → 구간 분할 → 색인 중… ${file.name}`)
          const fd = new FormData()
          fd.set('file', file); fd.set('cohort_id', String(cohort)); fd.set('type', f.type)
          fd.set('event_name', f.event_name)
          if (!many && f.title) fd.set('title', f.title)
          if (f.occurred_on) fd.set('occurred_on', f.occurred_on)
          try {
            const r = await api.upload(fd)
            ok++; items += r.timeline_items.length; passages += r.passages
          } catch (e) { bad.push(`${file.name}: ${(e as Error).message}`) }
        }
        setFailures(bad)
        setMsg(`${files.length}개 중 ${ok}개를 업로드했고 구간 ${passages}개를 색인했습니다. 일정 항목은 ${items}개를 뽑았습니다${bad.length ? `. ${bad.length}개는 올리지 못했습니다` : ''}.`)
        if (ok) notify(`기록 ${ok}건을 업로드하고 색인했습니다.`)
        setFiles(bad.length ? files.filter((x) => bad.some((m) => m.startsWith(x.name + ':'))) : [])
        setF({ ...f, title: '' })
      }
      onSaved()
    } catch (e) { setMsg((e as Error).message) }
    setProgress(''); setBusy(false)
  }

  return (
    <details className="panel" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>기록 업로드</summary>
      <div className="form">
        <label className={`drop ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files) }}>
          <span>
            {files.length === 0 && '파일을 업로드하면 텍스트를 추출해 구간 단위로 색인하고, 아카이브에 보관합니다. 여러 파일을 한꺼번에 선택하거나 끌어다 놓을 수 있습니다. (PDF, 한글 hwp·hwpx, docx, txt)'}
            {files.length === 1 && `선택한 파일: ${files[0].name}`}
            {many && `선택한 파일 ${files.length}개`}
          </span>
          <input type="file" name="file" multiple accept=".pdf,.hwp,.hwpx,.docx,.txt,.md" onChange={(e) => addFiles(e.target.files)} />
          {many && <ul className="filelist">{files.map((x) => <li key={x.name + x.size}>{x.name}</li>)}</ul>}
        </label>
        <div className="row">
          <select aria-label="기수" name="cohort" value={cohort} onChange={(e) => set('cohort_id', +e.target.value)}>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="문서 종류" name="type" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <input type="date" aria-label="문서 날짜" name="occurred_on" value={f.occurred_on} onChange={(e) => set('occurred_on', e.target.value)} />
          {files.length > 0 && <span className="muted">날짜를 비우면 각 문서에서 찾습니다</span>}
        </div>
        {many && <p className="muted">여러 파일을 올릴 때는 기수, 종류, 행사명이 모든 파일에 똑같이 적용되고 제목은 파일 이름을 사용합니다.</p>}
        {!many && (
          <input placeholder={files.length ? '제목 (비우면 파일 이름을 사용합니다)' : '제목'} aria-label="제목" name="title" autoComplete="off" value={f.title} onChange={(e) => set('title', e.target.value)} />
        )}
        <input placeholder="행사명 (예: 정기총회)" aria-label="행사명" name="event_name" autoComplete="off" value={f.event_name} onChange={(e) => set('event_name', e.target.value)} />
        {files.length === 0 && (
          <textarea rows={5} aria-label="본문" name="body" placeholder="파일 대신 본문을 직접 붙여 넣어도 됩니다. 날짜는 2025-05-02 형식으로 적어 주세요." value={f.body}
            onChange={(e) => set('body', e.target.value)} />
        )}
        <div className="row">
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? '색인 중…' : files.length > 1 ? `${files.length}개 파일 업로드하기` : '업로드하고 색인하기'}</button>
          {progress && <span className="muted" role="status">{progress}</span>}
        </div>
        {msg && <p className="notice" role="status">{msg}</p>}
        {failures.length > 0 && <ul className="error filelist" role="alert">{failures.map((m) => <li key={m}>{m}</li>)}</ul>}
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
    if (!r.question) { setMsg('질문을 모두 마쳤습니다. 답변이 교훈 기록으로 남았습니다.'); notify('인터뷰를 마쳤습니다. 교훈이 기록에 남았습니다.'); setN(0) }
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
            <p className="muted">행사를 고르면 AI 선배가 후회한 점과 다음 기수에게 남길 말을 물어봅니다. 답변은 교훈 기록으로 저장됩니다.</p>
            <div className="row">
              <select aria-label="기수" name="cohort" value={cid} onChange={(e) => { setCohort(+e.target.value); setEvent('') }}>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select aria-label="인터뷰할 행사" name="event" value={event || options[0] || ''} onChange={(e) => setEvent(e.target.value)} disabled={!options.length}>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className="grow" aria-label="직접 입력한 행사명" name="event_custom" autoComplete="off" placeholder="목록에 없으면 직접 입력해 주세요" value={custom} onChange={(e) => setCustom(e.target.value)} />
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
