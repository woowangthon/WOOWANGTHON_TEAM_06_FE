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
      <header className="top">
        <h1>졸업하지 않는 선배</h1>
        <nav>
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'last' && <LastYear onOpenRecord={showRecord} />}
        {tab === 'ask' && <Ask onOpenRecord={showRecord} />}
        {tab === 'records' && <Records openId={openRecord} onClose={() => setOpenRecord(null)} />}
      </main>
    </>
  )
}
