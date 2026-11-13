import { useState } from 'react'
import { api, type AskResult } from '../api'
import { useToast } from '../toast'
import SideSlot from '../SideSlot'
import Md from '../Md'

const EXAMPLES = ['MT 때 시간이 왜 밀렸나요?', '정기총회는 어떻게 준비했나요?', 'LT 레크는 무엇을 했나요?']
const RK = 'recent-questions'
const loadRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RK) ?? '[]') } catch { return [] } }

export default function Ask({ onOpenRecord }: { onOpenRecord: (id: number, quote?: string) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<AskResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const notify = useToast()

  const submit = async (text = q) => {
    if (!text.trim()) return
    setQ(text); setBusy(true); setError('')
    try {
      setRes(await api.ask(text))
      const next = [text, ...recent.filter((x) => x !== text)].slice(0, 5)
      setRecent(next)
      try { localStorage.setItem(RK, JSON.stringify(next)) } catch { /* private mode */ }
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  const lead = res && (res.answer.startsWith('기록에는 이렇게') ? res.answer.split('\n')[0] : res.answer)

  return (
    <section>
      <h2 className="ask-h">지난 기수 기록에서<br />찾아서 알려드립니다</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        업로드한 기록은 구간 단위로 색인되어 있습니다. 질문과 관련된 구간만 찾아서 그 내용을 근거로 답합니다.
      </p>
      <div className="ask-box">
        <input placeholder="예: MT 때 시간이 왜 밀렸나요?" aria-label="질문" name="question" autoComplete="off" enterKeyHint="search" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="btn primary" onClick={() => submit()} disabled={busy}>{busy ? '찾는 중…' : '묻기'}</button>
      </div>
      <SideSlot>
        <div className="side-block">
          <p className="side-label">예시 질문</p>
          <div className="chips">
            {EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => submit(x)}>{x}</button>)}
          </div>
        </div>
        {recent.length > 0 && (
          <div className="side-block">
            <p className="side-label">최근 질문</p>
            <div className="chips">
              {recent.map((x) => <button key={x} className="chip" onClick={() => submit(x)}>{x}</button>)}
            </div>
          </div>
        )}
      </SideSlot>
      {error && <p className="error" role="alert">{error}</p>}
      {busy && <div className="skeleton" aria-hidden="true"><i /><i /></div>}
      {res && !busy && (
        <div className="answer" aria-live="polite">
          <Md className="lead" text={lead ?? ''} />
          {res.retrieved !== undefined && (
            <p className="retrieval">지식베이스에서 관련 구간 {res.retrieved}개를 찾았고, 그중 {res.sources.length}개를 근거로 사용했습니다.</p>
          )}
          <div className="actions">
            <button className="btn" onClick={() => navigator.clipboard?.writeText(res.answer).then(() => notify('답변을 복사했습니다.'))}>답변 복사</button>
          </div>
          {res.sources.map((s) => (
            <div key={s.record_id} className="src">
              <p className="src-meta">
                근거 기록 · <button className="link" onClick={() => onOpenRecord(s.record_id, s.quote)}>{s.occurred_on} {s.title}</button>
              </p>
              {s.quote.startsWith('|') || s.quote.includes('\n|') ? <Md className="quote" text={s.quote} /> : <p className="quote"><mark>{s.quote}</mark></p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
