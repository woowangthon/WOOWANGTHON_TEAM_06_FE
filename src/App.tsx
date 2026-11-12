import { useState } from 'react'
import LastYear from './pages/LastYear'
import Ask from './pages/Ask'
import Records from './pages/Records'

const TABS = [
  ['last', '작년 이맘때'],
  ['ask', '선배에게 묻기'],
  ['records', '기록'],
] as const
type Tab = (typeof TABS)[number][0]

export default function App() {
  const [tab, setTab] = useState<Tab>('last')
  const [openRecord, setOpenRecord] = useState<number | null>(null)

  const showRecord = (id: number) => {
    setOpenRecord(id)
    setTab('records')
  }

  return (
    <>
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
        {tab === 'last' && <LastYear onOpenRecord={showRecord} />}
        {tab === 'ask' && <Ask onOpenRecord={showRecord} />}
        {tab === 'records' && <Records openId={openRecord} onClose={() => setOpenRecord(null)} />}
      </main>
    </>
  )
}
