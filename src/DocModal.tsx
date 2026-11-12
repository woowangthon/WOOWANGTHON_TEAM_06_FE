import { useEffect, useRef, useState } from 'react'
import { api, BASE, type SeniorRecord } from './api'

type Props = { id: number; quote?: string; onClose: () => void }

export default function DocModal({ id, quote, onClose }: Props) {
  const [rec, setRec] = useState<SeniorRecord | null>(null)
  const [tab, setTab] = useState<'pdf' | 'text'>('text')
  const [error, setError] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)
  const markRef = useRef<HTMLElement>(null)

  useEffect(() => {
    api.record(id).then((r) => { setRec(r); setTab(r.has_pdf && !quote ? 'pdf' : 'text') }).catch((e) => setError(e.message))
  }, [id, quote])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  useEffect(() => { if (tab === 'text') markRef.current?.scrollIntoView({ block: 'center' }) }, [tab, rec])

  const at = rec && quote ? rec.body.indexOf(quote) : -1

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={rec?.title ?? '원문'} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="tags">{rec ? `${rec.occurred_on} · ${rec.event_name}` : ''}</p>
            <h2>{rec?.title ?? '불러오는 중…'}</h2>
          </div>
          <div className="row">
            {rec?.has_pdf && (
              <div className="seg" role="tablist">
                <button role="tab" aria-selected={tab === 'pdf'} className={tab === 'pdf' ? 'on' : ''} onClick={() => setTab('pdf')}>원본 문서</button>
                <button role="tab" aria-selected={tab === 'text'} className={tab === 'text' ? 'on' : ''} onClick={() => setTab('text')}>텍스트</button>
              </div>
            )}
            <button ref={closeRef} className="btn" onClick={onClose}>닫기</button>
          </div>
        </header>
        <div className="modal-body">
          {error && <p className="error" role="alert">{error}</p>}
          {rec && tab === 'pdf' && <iframe title={rec.title} src={`${BASE}/api/records/${rec.id}/pdf#view=FitH`} />}
          {rec && tab === 'text' && (
            <div className="text-view">
              {!rec.has_pdf && <p className="notice" style={{ marginTop: 0 }}>이 문서는 원본 파일을 화면에 띄울 수 없어서 추출한 텍스트로 보여준다.</p>}
              <p className="body">
                {at >= 0 ? (
                  <>
                    {rec.body.slice(0, at)}
                    <mark ref={markRef}>{quote}</mark>
                    {rec.body.slice(at + quote!.length)}
                  </>
                ) : rec.body}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
