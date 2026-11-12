import { useEffect, useState } from 'react'
import { api, setKey, Unauthorized } from './api'
import LastYear from './pages/LastYear'
import Ask from './pages/Ask'
import Records from './pages/Records'
import Decisions from './pages/Decisions'
import DocModal from './DocModal'
import { ToastProvider } from './toast'

const TABS = [
  ['last', '작년 이맘때'],
  ['ask', '선배에게 묻기'],
  ['records', '기록'],
  ['decisions', '결정'],
] as const
type Tab = (typeof TABS)[number][0]

const fromHash = (): Tab => {
  const h = location.hash.replace('#/', '')
  return (TABS.find(([k]) => k === h)?.[0] ?? 'last') as Tab
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(fromHash)
  const [locked, setLocked] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [doc, setDoc] = useState<{ id: number; quote?: string } | null>(null)

  const setTab = (t: Tab) => { location.hash = `/${t}`; setTabState(t) }
  useEffect(() => {
    const on = () => setTabState(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    api.cohorts().catch((e) => e instanceof Unauthorized && setLocked(true))
  }, [])

  if (locked) {
    return (
      <main className="gate">
        <h1 className="brand">졸업하지 않는 선배</h1>
        <p>접근 키를 입력하세요. 키는 제출 안내에 적혀 있다.</p>
        <form onSubmit={(e) => { e.preventDefault(); setKey(keyInput.trim()); location.reload() }}>
          <input type="password" name="access-key" aria-label="접근 키" autoComplete="off" autoFocus value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          <button className="btn primary" type="submit">들어가기</button>
        </form>
      </main>
    )
  }

  const openDoc = (id: number, quote?: string) => setDoc({ id, quote })

  return (
    <ToastProvider>
      <a className="skip" href="#main">본문으로 건너뛰기</a>
      <header className="top">
        <div className="top-in">
          <h1 className="brand">졸업하지 않는 선배</h1>
          <p className="tagline">지난 기수가 남긴 기록을 먼저 꺼내 주는 AI 선배</p>
          <nav aria-label="화면">
            {TABS.map(([k, label]) => (
              <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main id="main">
        {tab === 'last' && <LastYear onOpenRecord={openDoc} />}
        {tab === 'ask' && <Ask onOpenRecord={openDoc} />}
        {tab === 'records' && <Records onOpenDoc={openDoc} />}
        {tab === 'decisions' && <Decisions onOpenDoc={openDoc} goLast={() => setTab('last')} />}
      </main>
      {doc && <DocModal id={doc.id} quote={doc.quote} onClose={() => setDoc(null)} />}
    </ToastProvider>
  )
}
