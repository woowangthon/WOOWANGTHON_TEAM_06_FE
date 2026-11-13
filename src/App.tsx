import { useEffect, useState } from 'react'
import { api, setKey, Unauthorized, type Stats } from './api'
import LastYear from './pages/LastYear'
import Ask from './pages/Ask'
import Records from './pages/Records'
import Decisions from './pages/Decisions'
import Graph from './pages/Graph'
import DocModal from './DocModal'
import { ToastProvider } from './toast'

const TABS = [
  ['last', '작년 이맘때', 'clock'],
  ['ask', '선배에게 묻기', 'chat'],
  ['records', '기록 아카이브', 'inbox'],
  ['graph', '지식 그래프', 'graph'],
  ['decisions', '결정', 'check'],
] as const

const ICON: Record<string, string> = {
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  chat: 'M4 5h16v11H9l-5 4V5z',
  inbox: 'M3 13l3-8h12l3 8v6H3v-6zm0 0h5a4 4 0 008 0h5',
  check: 'M5 12l4 4 10-10',
  graph: 'M6 7a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4zM12 21a2 2 0 100-4 2 2 0 000 4zM6 7l6 10M18 7l-6 10M8 5h8',
}
type Tab = (typeof TABS)[number][0]

const fromHash = (): Tab => {
  const h = location.hash.replace('#/', '')
  return (TABS.find(([k]) => k === h)?.[0] ?? 'last') as Tab
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(fromHash)
  const [locked, setLocked] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [search, setSearch] = useState('')
  const [registerTick, setRegisterTick] = useState(0)
  const [counts, setCounts] = useState({ records: 0, decisions: 0 })
  const [stats, setStats] = useState<Stats | null>(null)
  const [doc, setDoc] = useState<{ id: number; quote?: string } | null>(null)

  const setTab = (t: Tab) => { location.hash = `/${t}`; setTabState(t) }
  useEffect(() => {
    const on = () => setTabState(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    Promise.all([api.records(), api.decisions(), api.stats()]).then(([r, d, st]) => { setCounts({ records: r.length, decisions: d.length }); setStats(st) }).catch(() => {})
  }, [tab, doc])
  useEffect(() => {
    api.cohorts().catch((e) => e instanceof Unauthorized && setLocked(true))
  }, [])

  if (locked) {
    return (
      <main className="gate">
        <h1 className="brand">졸업하지 않는 선배</h1>
        <p>접근 키를 입력해 주세요. 키는 제출 안내에 적혀 있습니다.</p>
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
      <header className="topbar">
        <button className="logo" onClick={() => setTab('last')} aria-label="처음으로">
          <span className="logo-mark" aria-hidden="true">선</span>졸업하지 않는 선배
        </button>
        <form className="gsearch" role="search" onSubmit={(e) => { e.preventDefault(); setTab('records') }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 105 11.9l4.4 4.4M11 4a7 7 0 010 14" /></svg>
          <input type="search" name="global-search" aria-label="기록 검색" placeholder="기록 검색 (제목, 행사, 본문)" autoComplete="off"
            value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value && tab !== 'records') setTab('records') }} />
        </form>
      </header>
      <div className="shell">
        <aside className="side">
          <button className="compose" onClick={() => { setTab('records'); setRegisterTick((t) => t + 1) }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>기록 업로드
          </button>
          <nav aria-label="화면">
            {TABS.map(([k, label, icon]) => (
              <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[icon]} /></svg>
                <span>{label}</span>
                {k === 'records' && <em>{counts.records}</em>}
                {k === 'decisions' && <em>{counts.decisions}</em>}
              </button>
            ))}
          </nav>
          {stats && (
            <div className="kb" aria-label="지식베이스 현황">
              <b>지식베이스 (RAG 색인)</b>
              <dl>
                <dt>문서</dt><dd>{stats.records}</dd>
                <dt>색인된 구간</dt><dd>{stats.passages}</dd>
                <dt>행사</dt><dd>{stats.events}</dd>
                <dt>원본 보관</dt><dd>{stats.with_original}</dd>
              </dl>
            </div>
          )}
          <div id="side-slot" className="side-slot" />
        </aside>
        <main id="main">
          {tab === 'last' && <LastYear onOpenRecord={openDoc} />}
          {tab === 'ask' && <Ask onOpenRecord={openDoc} />}
          {tab === 'records' && <Records onOpenDoc={openDoc} search={search} registerTick={registerTick} />}
          {tab === 'graph' && <Graph onOpenDoc={openDoc} onSearch={(q) => { setSearch(q); setTab('records') }} />}
          {tab === 'decisions' && <Decisions onOpenDoc={openDoc} goLast={() => setTab('last')} />}
        </main>
      </div>
      {doc && <DocModal id={doc.id} quote={doc.quote} onClose={() => setDoc(null)} />}
    </ToastProvider>
  )
}
