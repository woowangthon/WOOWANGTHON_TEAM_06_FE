import { useState } from 'react'
import LastYear from './pages/LastYear'
import Ask from './pages/Ask'
import Records from './pages/Records'
import DocModal from './DocModal'

const TABS = [
  ['last', '작년 이맘때'],
  ['ask', '선배에게 묻기'],
  ['records', '기록'],
] as const
type Tab = (typeof TABS)[number][0]

export default function App() {
  const [tab, setTab] = useState<Tab>('last')
  const [doc, setDoc] = useState<{ id: number; quote?: string } | null>(null)
  const openDoc = (id: number, quote?: string) => setDoc({ id, quote })

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
        {tab === 'last' && <LastYear onOpenRecord={openDoc} />}
        {tab === 'ask' && <Ask onOpenRecord={openDoc} />}
        {tab === 'records' && <Records onOpenDoc={openDoc} />}
      </main>
      {doc && <DocModal id={doc.id} quote={doc.quote} onClose={() => setDoc(null)} />}
    </>
  )
}
