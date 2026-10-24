// Why this time? as a Paper sheet over the dimmed globe: Anchors → the Monte Carlo fan → the date
// → the hand, then the Track record tab. It explains the real forecast only, never game state.
import { useState } from 'react'
import type { BacktestFile, NodeId, Timeline, World } from '../../contracts.ts'
import { clockFace, readingLine } from '../clock/Clock.tsx'
import type { Hand } from '../clock/scale.ts'
import { dmy, longDate, pct } from '../format.ts'
import { TrackRecord } from '../track/TrackRecord.tsx'

export type WhyTab = 'anchors' | 'fan' | 'date' | 'hand' | 'track'
const TABS: [WhyTab, string][] = [['anchors', 'Anchors'], ['fan', 'Fan'], ['date', 'Date'], ['hand', 'Hand'], ['track', 'Track record']]
const NODES: NodeId[] = ['asi2030', 'asi2040', 'asi2100', 'cat2100']

interface Props { world: World; timeline: Timeline; hand: Hand; pin: number; daysPerSecond: number | null; backtest: BacktestFile; tab: WhyTab; onTab: (t: WhyTab) => void; onClose: () => void }

export function WhySheet({ world, timeline, hand, pin, daysPerSecond, backtest, tab, onTab, onClose }: Props) {
  const c = timeline.clock
  const years = c.minutesToMidnight ?? 0
  const real = <span className="dc-label dc-label--real">Real forecast</span>
  const next = (t: WhyTab, text: string) => <a className="next" href="#" onClick={(e) => (e.preventDefault(), onTab(t))}>{text}</a>
  const body = {
    anchors: <>
      <div className="lede"><span className="dc-label dc-label--real">Real</span><span className="dc-data">prices as of {dmy(world.asOf)}</span></div>
      <h3>Real money sets the anchors</h3>
      <p>Four prediction-market prices go in. No model and no opinion is added at this step.</p>
      <div>
        {NODES.map((id) => { const h = world.anchorHistory[id]
          return <div className="anc" key={id}><div><a href={h.url} target="_blank" rel="noopener">{h.question}</a></div><b>{pct(world.anchors[id])}</b>
            <span>Manifold · {h.traders} traders · last trade {dmy(h.lastTradeTs)}</span></div> })}
        <div className="anc"><div>Gap from superintelligence to catastrophe</div><b>{world.lagMeanYears} y</b>
          <span><span className="dc-label dc-label--rule">Game rule</span> No market backs it, so the clock shows 1 to 10 years as a range.</span></div>
      </div>
      {next('fan', 'Next: 10,000 futures')}
    </>,
    fan: <>
      <div className="lede">{real}<span className="dc-data">sim.ts · seed 1 · 10,000 paths</span></div>
      <h3>10,000 futures</h3>
      <p>Each future draws when superintelligence arrives, whether it goes wrong, and how long the gap is. The line is the share of futures gone wrong by each quarter.</p>
      <Fan timeline={timeline} />
      <p className="dc-dim" style={{ font: 'var(--type-body)' }}>By 2100, {pct(c.pCat2100)} of futures go wrong. The globe plays one of these futures at a time.</p>
      {next('date', 'Next: the date')}
    </>,
    date: <>
      <div className="lede">{real}</div>
      <h3>{c.date10 ? longDate(c.date10) : 'After 2100'}</h3>
      <p>The first day on which 1 in 10 futures has gone wrong. Below, 400 squares stand for the 10,000 futures, 25 each. By then, 40 are red.</p>
      <div className="waffle" role="img" aria-label="40 of 400 squares red">{Array.from({ length: 400 }, (_, i) => <i key={i} className={i < 40 ? 'c' : ''} />)}</div>
      <p className="dc-dim" style={{ font: 'var(--type-body)' }}>With a gap of 1 year it is {c.date10Range[0] ? dmy(c.date10Range[0]) : 'after 2100'}; with 10 years, {c.date10Range[1] ? dmy(c.date10Range[1]) : 'after 2100'}.</p>
      {next('hand', 'Next: the hand')}
    </>,
    hand: <>
      <div className="lede">{real}<span className="dc-faint">{daysPerSecond ? `1 s ≈ ${Math.round(daysPerSecond)} days` : ''}</span></div>
      <div style={{ width: 240 }} dangerouslySetInnerHTML={{ __html: clockFace(hand, pin) }} />
      <h3>{readingLine(hand)}</h3>
      <p>The clock starts where the Bulletin of the Atomic Scientists stands today, {pin} seconds to midnight. Our forecast sets the pace: the 1-in-10 date is {years.toFixed(1)} years away, so each second on the face is about {daysPerSecond ? Math.round(daysPerSecond) : '–'} days.</p>
      <p>Before today the hand shows the Bulletin's own settings. From today, market prices move it; nothing else does. The grey band is the 1 to 10 year range.</p>
      {next('track', 'See the track record')}
      <p className="verdict">A prediction, not a prophecy.</p>
    </>,
    track: <TrackRecord bt={backtest} fixture={backtest.leakage.canary.note === 'Fixture.'} />,
  }[tab]
  return (
    <div className="scrim on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet dc-sheet" data-theme="paper" role="dialog" aria-modal="true" aria-labelledby="why-h">
        <button className="x" aria-label="Close" onClick={onClose}>×</button>
        <h2 className="title" id="why-h">Why this time?</h2>
        <div className="split">
          <div className="lead">
            <div className="dc-tabs">{TABS.map(([k, t]) => <button key={k} aria-pressed={tab === k} onClick={() => onTab(k)}>{t}</button>)}</div>
            <div className="dc-thumb"><div className="box" dangerouslySetInnerHTML={{ __html: clockFace(hand, pin, false) }} /><div className="cap">It is {Math.round(hand.seconds)} seconds to midnight</div><div className="dc-data">real forecast · {dmy(world.asOf)}</div></div>
          </div>
          <article className="story">{body}</article>
        </div>
      </div>
    </div>
  )
}

/** Share of futures gone wrong by quarter (today's Monte Carlo), the 1-in-10 line and the date. */
function Fan({ timeline }: { timeline: Timeline }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 600, H = 250, L = 40, B = 26, T = 14, R = 10
  const now = Date.parse(timeline.asOf)
  const pts = timeline.frames.filter((f) => f.provenance === 'projected').map((f) => [Date.parse(f.start) + 91 * 864e5, f.pCat] as const)
  const all = [[now, 0] as const, ...pts]
  const x0 = now, x1 = all.at(-1)![0], top = Math.max(0.15, Math.ceil((all.at(-1)![1] + 0.02) * 20) / 20)
  const x = (t: number) => L + ((t - x0) / (x1 - x0)) * (W - L - R)
  const y = (p: number) => T + (1 - p / top) * (H - T - B)
  const d10 = timeline.clock.date10 ? Date.parse(timeline.clock.date10) : null
  const txt = { fill: 'var(--ink-3)', font: '400 12px var(--font-sans)' }
  const years = []
  for (let yr = new Date(x0).getUTCFullYear() + 1; Date.UTC(yr, 0, 1) <= x1; yr += 2) years.push(yr)
  const h = hover != null ? all[hover] : null
  return (
    <div className="fan">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Share of futures gone wrong by quarter"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W
          let best = 0; all.forEach((p, i) => { if (Math.abs(x(p[0]) - px) < Math.abs(x(all[best][0]) - px)) best = i }); setHover(best) }}
        onPointerLeave={() => setHover(null)}>
        {[0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].filter((p) => p <= top).map((p) => <g key={p}>
          <line x1={L} x2={W - R} y1={y(p)} y2={y(p)} style={{ stroke: p === 0.1 ? 'var(--ink-3)' : 'var(--rule)' }} strokeDasharray={p === 0.1 ? '4 3' : undefined} />
          <text x={L - 8} y={y(p) + 4} style={txt} textAnchor="end">{Math.round(p * 100)}%</text></g>)}
        {years.map((yr) => <text key={yr} x={x(Date.UTC(yr, 0, 1))} y={H - 6} style={txt} textAnchor="middle">{yr}</text>)}
        <path d={all.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')} style={{ stroke: 'var(--ink)', strokeWidth: 2, fill: 'none' }} />
        {d10 && d10 <= x1 && <>
          <line x1={x(d10)} x2={x(d10)} y1={y(0.1)} y2={H - B} style={{ stroke: 'var(--ink-3)' }} strokeDasharray="2 3" />
          <circle cx={x(d10)} cy={y(0.1)} r={5} style={{ fill: 'var(--ink)', stroke: 'var(--ground)', strokeWidth: 2 }} />
          <text x={x(d10) - 9} y={y(0.1) - 9} textAnchor="end" style={{ fill: 'var(--ink)', font: '600 12px var(--font-sans)' }}>1 in 10 · {dmy(timeline.clock.date10!)}</text></>}
        {h && <><line x1={x(h[0])} x2={x(h[0])} y1={T} y2={H - B} style={{ stroke: 'var(--ink-2)' }} /><circle cx={x(h[0])} cy={y(h[1])} r={4} style={{ fill: 'var(--ink)' }} /></>}
      </svg>
      {h && <div className="tip dc-panel" style={{ display: 'block', left: `${Math.min(70, (x(h[0]) / W) * 100)}%` }}><b>{dmy(new Date(h[0]).toISOString())}</b> · {(h[1] * 100).toFixed(1)}% of futures gone wrong</div>}
    </div>
  )
}
