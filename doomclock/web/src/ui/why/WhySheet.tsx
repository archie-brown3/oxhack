// Why this time? as a Paper sheet over the dimmed globe: Anchors → the Monte Carlo fan → the date
// → the hand, then the Track record tab. It explains the real forecast only, never game state.
import { useEffect, useState } from 'react'
import type { BacktestFile, NodeId, RecordedFuture, RecordedStep, Rubric, Timeline, World } from '../../contracts.ts'
import { loadReplica } from '../engine/replica/load.ts'
import { renderMarkdown } from '../engine/replica/Step4Parse.ts'
import { clockFace } from '../clock/Clock.tsx'
import type { Hand } from '../clock/scale.ts'
import { dmy, longDate, pct } from '../format.ts'
import { loadTrack } from '../../app/data.ts'
import { TrackRecord } from '../track/TrackRecord.tsx'
import { Label } from '../Label.tsx'
import { MarketCurve } from '../chart/MarketCurve.tsx'
import { msToYear } from '../../engine/index.ts'
import { measuredScore } from './whyCopy.ts'

export type WhyTab = 'when' | 'danger' | 'track'
const TABS: [WhyTab, string][] = [['when', 'When'], ['danger', 'How dangerous'], ['track', 'Track record']]
const NODES: NodeId[] = ['asi2030', 'asi2040', 'asi2100', 'cat2100']
const RUBRIC: [keyof Rubric, string, string][] = [['lossOfControl', 'Loss of control', 'higher is worse'], ['misuse', 'Misuse', 'higher is worse'], ['oversight', 'Oversight', 'higher is better'], ['racePressure', 'Race pressure', 'higher is worse']]

interface Props {
  world: World; timeline: Timeline; hand: Hand; pin: number; daysPerSecond: number | null; backtest: BacktestFile
  /** The future being watched and its step now (null before the first step). */
  future: RecordedFuture | null; step: RecordedStep | null; luck: number | null
  tab: WhyTab; onTab: (t: WhyTab) => void; onClose: () => void
}

export function WhySheet({ world, timeline, hand, pin, backtest, future, step, luck, tab, onTab, onClose }: Props) {
  const next = (t: WhyTab, text: string) => <a className="next" href="#" onClick={(e) => (e.preventDefault(), onTab(t))}>{text}</a>
  const [measured, setMeasured] = useState<BacktestFile | null>(null)
  useEffect(() => { let on = true; loadTrack().then((x) => on && setMeasured(x.bt)); return () => { on = false } }, [])
  const score = measuredScore(measured)
  const catTraders = world.anchorHistory.cat2100.traders
  const body = {
    when: <>
      <div className="lede"><Label kind="real" /><span className="dc-data">prices as of {dmy(world.asOf)}</span></div>
      <h3>Market prices say when</h3>
      <MarketCurve anchors={world.anchors} at={msToYear(Date.parse(world.asOf))} lagMeanYears={world.lagMeanYears} date10={timeline.clock.date10} />
      <p>The clock counts down to one date: the first day the chance of an AI catastrophe passes 1 in 10. Today that is {timeline.clock.date10 ? longDate(timeline.clock.date10) : 'after 2100'}.</p>
      <p>Four prediction markets set it: superintelligence by 2030, 2040 and 2100, and an AI catastrophe by 2100. We add one assumption no market prices, an average {world.lagMeanYears}-year gap from superintelligence to catastrophe <Label kind="game-rule" />. 10,000 simulated futures turn them into the curve above.</p>
      <p>On the face, today is pinned to the Bulletin's own setting. A later date adds seconds and the hand moves back from midnight; an earlier date moves it closer.</p>
      <p>The backtest scores these market prices 30 days out{score ? ` (Brier ${score.brier}, a coin scores ${score.coin})` : ''}, not the clock's date. The catastrophe market is thin: {catTraders} traders, play money.</p>
      <div>
        {NODES.map((id) => { const h = world.anchorHistory[id]
          return <div className="anc" key={id}><div><a href={h.url} target="_blank" rel="noopener">{h.question}</a></div><b>{pct(world.anchors[id])}</b>
            <span>Manifold · {h.traders} traders · last trade {dmy(h.lastTradeTs)}</span></div> })}
        <div className="anc"><div>Gap from superintelligence to catastrophe</div><b>{world.lagMeanYears} y</b>
          <span><Label kind="game-rule" /> No market backs it, so the clock shows 1 to 10 years as a range.</span></div>
      </div>
      {next('danger', 'Next: how dangerous')}
    </>,
    danger: <>
      <div className="lede"><Label kind="simulated" />{future && <span className="dc-data">Future {future.id}{step ? `, step ${step.step}` : ''}{future.fixture ? ' · illustrative stand-in, not a recorded run' : ''}</span>}</div>
      <h3>The simulated world says how dangerous</h3>
      <p>MiroFish plays the world forward six months at a time, as a society of accounts on a simulated X. What governments and labs do there becomes events, and a report scores how dangerous the world got. Both move this future's odds by labelled rules <Label kind="game-rule" />, never the real clock. A scenario, not a prediction.</p>
      {!future || !step ? <p className="dc-dim">Press play on a future. Its first step lands here.</p> : <>
        {step.summary && <p>{step.summary}</p>}
        <ReportProse futureId={future.id} step={step.step} />
        <div className="rubric">{RUBRIC.map(([k, name, hint]) => (
          <div className="rub" key={k}><span>{name}<small>{hint}</small></span>
            <span className="bars" aria-label={`${name}: ${step.rubric[k]} of 3, today ${future.baselineRef[k]}`}>{[1, 2, 3].map((n) => <i key={n} className={n <= step.rubric[k] ? 'on' : ''} />)}</span>
            <b>{step.rubric[k]}<small> today {future.baselineRef[k]}</small></b></div>))}</div>
        <h4>Events this step</h4>
        {step.events.length ? step.events.map((e) => <div className="irow" key={e.ts + e.title}><span className="dc-data">{dmy(e.ts)}</span><div>{e.title}<span className="src dc-data">{e.who ?? 'MiroFish'}</span></div></div>) : <p className="dc-dim">No event passed the checks this step.</p>}
        <h4>Three lines</h4>
        <ThreeLines future={future} step={step.step} />
        {luck != null && <p className="dc-dim">{future.fixture ? 'The gap between the dotted and dashed lines is the game rules on this stand-in. It is not a recorded result.' : `About ${Math.round(luck * 100)}% of the recorded moves are luck, the gap between the dotted and dashed lines.`}</p>}
      </>}
      {next('track', 'Next: track record')}
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

/** MiroFish's report, as written. Numbers in it stay inside the prose; they are not our figures. */
function ReportProse({ futureId, step }: { futureId: number; step: number }) {
  const [html, setHtml] = useState<string | null>(null)
  const [spike, setSpike] = useState(false)
  const [earlier, setEarlier] = useState(false)
  const [miss, setMiss] = useState(false)
  useEffect(() => {
    let live = true
    setHtml(null); setMiss(false)
    loadReplica(futureId, step).then((d) => {
      if (!live) return
      const md = d?.step.report.markdown_content?.trim()
      if (!d || !md) { setMiss(true); return }
      setSpike(d.spike)
      // MiroFish keeps one report per simulation run, so later steps of a recorded future can carry an earlier step's report.
      setEarlier(!d.spike && Date.parse(d.step.report.created_at) < Date.parse(String(d.step.runStatus?.started_at ?? '')))
      setHtml(renderMarkdown(md))
    })
    return () => { live = false }
  }, [futureId, step])
  if (miss) return null
  return (
    <section className="report-prose" aria-label="MiroFish report">
      <div className="lede"><Label kind="simulated" />{spike && <span className="dc-data">Stand-in report from the 24 Oct spike, not this future.</span>}{earlier && <span className="dc-data">Written after an earlier step of this future; MiroFish keeps one report per run.</span>}</div>
      <h4>Report, as written</h4>
      {html ? <div className="report-body" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="dc-dim">Loading the report…</p>}
    </section>
  )
}

/** The 1-in-10 date at each step: with events and report (solid), rules off (dashed), today's odds with no events (dotted). */
function ThreeLines({ future, step }: { future: RecordedFuture; step: number }) {
  const W = 420, H = 150, L = 40, B = 22, T = 10, R = 10
  const n = future.steps.length
  const series: [string, string, string | undefined, (s: RecordedStep) => number][] = [
    ['With events and report', 'var(--ink)', undefined, (s) => s.date10], ['Rules off', 'var(--ink-2)', '5 3', (s) => s.rulesOffDate10], ['Today\'s odds, no events', 'var(--ink-3)', '1 3', (s) => s.noEventsDate10]]
  const ys = future.steps.flatMap((s) => series.map(([, , , f]) => f(s)))
  const lo = Math.floor(Math.min(...ys) * 2) / 2, hi = Math.max(lo + 1, Math.ceil(Math.max(...ys) * 2) / 2)
  const x = (i: number) => L + (i / Math.max(1, n - 1)) * (W - L - R), y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const txt = { fill: 'var(--ink-3)', font: '400 11px var(--font-sans)' }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="The 1-in-10 date at each step, three lines">
        {[lo, (lo + hi) / 2, hi].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--rule)' }} /><text x={L - 6} y={y(v) + 4} textAnchor="end" style={txt}>{v.toFixed(1)}</text></g>)}
        {future.steps.map((s, i) => <text key={s.step} x={x(i)} y={H - 6} textAnchor="middle" style={{ ...txt, fontWeight: s.step === step ? 700 : 400 }}>{s.end.slice(0, 4)} {+s.end.slice(5, 7) <= 1 ? 'Jan' : 'Jul'}</text>)}
        {series.map(([name, c, dash, f]) => <path key={name} d={future.steps.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(f(s)).toFixed(1)}`).join('')} style={{ stroke: c, strokeWidth: 2, fill: 'none' }} strokeDasharray={dash} />)}
        <circle cx={x(step - 1)} cy={y(future.steps[step - 1].date10)} r={4} style={{ fill: 'var(--ink)' }} />
      </svg>
      <div className="dc-faint" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>{series.map(([name, c, dash]) => <span key={name}><svg width="22" height="8" style={{ verticalAlign: 'middle' }}><line x1="0" x2="22" y1="4" y2="4" style={{ stroke: c, strokeWidth: 2 }} strokeDasharray={dash} /></svg> {name}</span>)}</div>
    </div>
  )
}

