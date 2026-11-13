import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type Graph as GraphData, type GraphNode } from '../api'
import SideSlot from '../SideSlot'

type Kind = 'cohort' | 'event' | 'meeting' | 'lesson' | 'decision'
const KINDS: { key: Kind; label: string; color: string; r: number }[] = [
  { key: 'cohort', label: '기수', color: '#1f2328', r: 26 },
  { key: 'event', label: '행사', color: '#3b3fd9', r: 15 },
  { key: 'meeting', label: '회의록·행사 문서', color: '#8b93a7', r: 7 },
  { key: 'lesson', label: '교훈(평가·인터뷰)', color: '#d98a00', r: 7 },
  { key: 'decision', label: '결정', color: '#1f7a4d', r: 8 },
]
const kindOf = (n: GraphNode): Kind => (n.type === 'event_doc' ? 'meeting' : (n.type as Kind))
const style = (n: GraphNode) => KINDS.find((k) => k.key === kindOf(n))!
const W = 1000, H = 640
const charge = (n: GraphNode) => (n.type === 'cohort' ? 6 : n.type === 'event' ? 3.5 : 1)

type Sim = { x: number; y: number; vx: number; vy: number; fixed?: boolean }

export default function Graph({ onOpenDoc, onSearch }: { onOpenDoc: (id: number) => void; onSearch: (q: string) => void }) {
  const [data, setData] = useState<GraphData | null>(null)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState<Record<Kind, boolean>>({ cohort: true, event: true, meeting: true, lesson: true, decision: true })
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [, tick] = useState(0)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const sim = useRef<Map<string, Sim>>(new Map())
  const alpha = useRef(1)
  const raf = useRef(0)
  const loop = useRef<() => void>(() => {})
  const fitted = useRef(false)
  const fit = () => {
    const ps = [...sim.current.values()]
    if (!ps.length) return
    const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y)
    const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60, y0 = Math.min(...ys) - 50, y1 = Math.max(...ys) + 50
    const k = Math.min(2, W / (x1 - x0), H / (y1 - y0))
    setView({ k, x: W / 2 - ((x0 + x1) / 2) * k, y: H / 2 - ((y0 + y1) / 2) * k })
  }
  const drag = useRef<{ id: string | null; pan: boolean; sx: number; sy: number; vx: number; vy: number } | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => { api.graph().then(setData).catch((e) => setError(e.message)) }, [])

  const shown = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], edges: [] as GraphData['edges'] }
    const ids = new Set(data.nodes.filter((n) => visible[kindOf(n)]).map((n) => n.id))
    return { nodes: data.nodes.filter((n) => ids.has(n.id)), edges: data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) }
  }, [data, visible])

  const neighbors = useMemo(() => {
    const m = new Map<string, { id: string; rel: string; out: boolean }[]>()
    for (const e of data?.edges ?? []) {
      if (!m.has(e.source)) m.set(e.source, [])
      if (!m.has(e.target)) m.set(e.target, [])
      m.get(e.source)!.push({ id: e.target, rel: e.rel, out: true })
      m.get(e.target)!.push({ id: e.source, rel: e.rel, out: false })
    }
    return m
  }, [data])

  // initial positions, then a cooling force simulation
  useEffect(() => {
    if (!data) return
    const s = sim.current
    const parent = new Map<string, string>()
    data.edges.filter((e) => e.rel !== 'next_term').forEach((e) => parent.set(e.target, e.source))
    const cohorts = data.nodes.filter((n) => n.type === 'cohort')
    const seedAt = (n: GraphNode, i: number) => {
      if (n.type === 'cohort') return { x: (W * (cohorts.indexOf(n) + 1)) / (cohorts.length + 1), y: H / 2 }
      const par = parent.get(n.id)
      const base = par ? s.get(par) : undefined
      const a = i * 2.399963  // golden angle spreads siblings
      const r = n.type === 'event' ? 170 : 55
      return { x: (base?.x ?? W / 2) + Math.cos(a) * r, y: (base?.y ?? H / 2) + Math.sin(a) * r }
    }
    const order = [...data.nodes].sort((a, b) => ['cohort', 'event'].indexOf(b.type) - ['cohort', 'event'].indexOf(a.type)).reverse()
    order.forEach((n, i) => { if (!s.has(n.id)) s.set(n.id, { ...seedAt(n, i), vx: 0, vy: 0 }) })
    alpha.current = 1
    fitted.current = false
    cancelAnimationFrame(raf.current)
    const step = () => {
      const a = alpha.current
      if (a < 0.02 && !drag.current?.id) { if (!fitted.current) { fitted.current = true; fit() } return }
      const nodes = shown.nodes
      for (let i = 0; i < nodes.length; i++) {
        const p = s.get(nodes[i].id)!
        for (let j = i + 1; j < nodes.length; j++) {
          const q = s.get(nodes[j].id)!
          let dx = p.x - q.x, dy = p.y - q.y
          const d2 = Math.max(dx * dx + dy * dy, 30)
          const f = (3800 * a * Math.sqrt(charge(nodes[i]) * charge(nodes[j]))) / d2
          const d = Math.sqrt(d2); dx /= d; dy /= d
          p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f
        }
        p.vx += (W / 2 - p.x) * 0.0015 * a; p.vy += (H / 2 - p.y) * 0.003 * a
      }
      for (const e of shown.edges) {
        const p = s.get(e.source), q = s.get(e.target)
        if (!p || !q) continue
        const rest = e.rel === 'has_event' ? 190 : e.rel === 'next_term' ? 240 : 66
        const dx = q.x - p.x, dy = q.y - p.y
        const d = Math.max(Math.hypot(dx, dy), 1)
        const f = ((d - rest) / d) * 0.06
        p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f
      }
      for (const n of nodes) {
        const p = s.get(n.id)!
        if (p.fixed) { p.vx = p.vy = 0; continue }
        p.vx *= 0.78; p.vy *= 0.78
        p.x += p.vx; p.y += p.vy
      }
      alpha.current *= 0.992
      tick((t) => t + 1)
      raf.current = requestAnimationFrame(step)
    }
    loop.current = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(step) }
    loop.current()
    return () => cancelAnimationFrame(raf.current)
  }, [data, shown])

  const reheat = (a = 0.5) => {
    alpha.current = Math.max(alpha.current, a)
    loop.current()
  }

  const toSvg = (cx: number, cy: number) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H }
  }
  const down = (e: React.PointerEvent, id: string | null) => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const p = toSvg(e.clientX, e.clientY)
    drag.current = { id, pan: id === null, sx: p.x, sy: p.y, vx: view.x, vy: view.y }
    if (id) { sim.current.get(id)!.fixed = true; reheat(0.4) }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = toSvg(e.clientX, e.clientY)
    if (d.id) {
      const n = sim.current.get(d.id)!
      n.x = (p.x - view.x) / view.k; n.y = (p.y - view.y) / view.k
      reheat(0.3)
    } else setView({ ...view, x: d.vx + (p.x - d.sx), y: d.vy + (p.y - d.sy) })
  }
  const up = () => {
    const d = drag.current
    if (d?.id) sim.current.get(d.id)!.fixed = false
    drag.current = null
  }
  const zoom = (f: number) => setView((v) => ({ k: Math.min(2.5, Math.max(0.5, v.k * f)), x: W / 2 - ((W / 2 - v.x) * Math.min(2.5, Math.max(0.5, v.k * f))) / v.k, y: H / 2 - ((H / 2 - v.y) * Math.min(2.5, Math.max(0.5, v.k * f))) / v.k }))

  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data])
  const focus = hover ?? selected
  const near = new Set<string>(focus ? [focus, ...(neighbors.get(focus) ?? []).map((x) => x.id)] : [])
  const sel = selected ? byId.get(selected) : null
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    data?.nodes.forEach((n) => { c[kindOf(n)] = (c[kindOf(n)] ?? 0) + 1 })
    return c
  }, [data])

  return (
    <section>
      <h2 className="ask-h">기록이 서로 이어지는 모습<br />지식 그래프</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        아카이브에 올린 기록을 기수, 행사, 문서, 교훈, 결정으로 나누어 연결했습니다. 점을 끌어서 옮기거나 눌러서 연결된 항목을 확인할 수 있습니다.
      </p>
      {error && <p className="error" role="alert">{error}</p>}

      <SideSlot>
        <div className="side-block">
          <p className="side-label">보기 (종류별 켜고 끄기)</p>
          <div className="legend">
            {KINDS.map((k) => (
              <label key={k.key} className="legend-row">
                <input type="checkbox" checked={visible[k.key]} onChange={(e) => setVisible({ ...visible, [k.key]: e.target.checked })} />
                <i style={{ background: k.color }} />
                <span>{k.label}</span>
                <em>{counts[k.key] ?? 0}</em>
              </label>
            ))}
          </div>
        </div>
        <div className="side-block">
          <p className="side-label">연결 관계</p>
          <ul className="rels">
            {Object.entries(data?.relations ?? {}).map(([k, v]) => <li key={k}>{v}</li>)}
          </ul>
        </div>
        <button className="btn" onClick={() => { sim.current.clear(); setView({ x: 0, y: 0, k: 1 }); setData((d) => (d ? { ...d } : d)) }}>다시 배치</button>
      </SideSlot>

      <div className="graph-wrap">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="graph" role="img" aria-label="기수, 행사, 문서, 교훈, 결정의 연결 그래프"
          onPointerDown={(e) => down(e, null)} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          onWheel={(e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 0.9) }}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {shown.edges.map((e, i) => {
              const p = sim.current.get(e.source), q = sim.current.get(e.target)
              if (!p || !q) return null
              const hot = focus && (e.source === focus || e.target === focus)
              return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                className={`edge ${e.rel === 'next_term' ? 'dash' : ''} ${hot ? 'hot' : ''}`} opacity={focus && !hot ? 0.15 : 1} />
            })}
            {shown.nodes.map((n) => {
              const p = sim.current.get(n.id)
              if (!p) return null
              const st = style(n)
              const r = n.type === 'event' ? st.r + Math.min(8, (n.count ?? 1) * 0.7) : st.r
              const dim = focus && !near.has(n.id)
              const label = n.type === 'cohort' || n.type === 'event' || n.id === focus || n.id === selected
              return (
                <g key={n.id} transform={`translate(${p.x} ${p.y})`} opacity={dim ? 0.2 : 1} className="node"
                  onPointerDown={(e) => down(e, n.id)} onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)}
                  onClick={() => setSelected(n.id)} tabIndex={0} role="button" aria-label={`${st.label} ${n.label}`}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(n.id)}>
                  <circle r={r} fill={st.color} stroke={n.id === selected ? '#fff' : 'none'} strokeWidth={3} />
                  {n.id === selected && <circle r={r + 5} fill="none" stroke={st.color} strokeWidth={2} />}
                  {label && <text y={r + 14} textAnchor="middle" className={n.type === 'cohort' ? 'lbl big' : 'lbl'}>{n.label.length > 22 ? n.label.slice(0, 22) + '…' : n.label}</text>}
                </g>
              )
            })}
          </g>
        </svg>
        <div className="zoom">
          <button className="btn" onClick={() => zoom(1.2)} aria-label="확대">+</button>
          <button className="btn" onClick={() => zoom(0.83)} aria-label="축소">−</button>
          <button className="btn" onClick={fit}>화면에 맞추기</button>
        </div>
      </div>

      <div className="graph-detail" aria-live="polite">
        {!sel && <p className="muted">점을 누르면 연결된 항목과 원문이 여기에 나타납니다.</p>}
        {sel && (
          <>
            <p className="tags">{style(sel).label}{sel.occurred_on ? ` · ${sel.occurred_on}` : ''}{sel.event_name ? ` · ${sel.event_name}` : ''}</p>
            <h3>{sel.label}</h3>
            <div className="actions">
              {sel.record_id && <button className="btn primary" onClick={() => onOpenDoc(sel.record_id!)}>{sel.has_pdf ? '원본 확인하기' : '원문 보기'}</button>}
              {sel.type === 'event' && <button className="btn primary" onClick={() => onSearch(sel.label)}>이 행사 기록 보기</button>}
            </div>
            <p className="side-label" style={{ marginTop: 14 }}>연결된 항목 {neighbors.get(sel.id)?.length ?? 0}개</p>
            <ul className="neigh">
              {(neighbors.get(sel.id) ?? []).slice(0, 14).map((x) => {
                const n = byId.get(x.id)!
                return (
                  <li key={x.id + x.rel}>
                    <em>{data?.relations[x.rel]}{x.out ? '' : ' (상위)'}</em>
                    <button className="link" onClick={() => setSelected(x.id)}>{n.label}</button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
