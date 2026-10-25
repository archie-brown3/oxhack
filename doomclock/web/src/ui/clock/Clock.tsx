// The clock corner (top-left, never hidden) and the "why the hand moved" callout beside it.
// The white hand is the real forecast: engine A only. Only market moves (frame.drivers) are
// causes; events in the same quarter are shown as context, never as causes.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClockReading, WorldEvent, WorldFrame } from '../../contracts.ts'
import { countdown, dmy, monthYear, qName, sourceName } from '../format.ts'
import type { Move } from '../../app/futures.ts'
import type { RecordedStep } from '../../contracts.ts'
import { face } from './face.ts'
import { FACE_SECONDS, type Hand } from './scale.ts'
import { Label } from '../Label.tsx'

const UNIT = FACE_SECONDS / 15 // seconds per face-minute: the face shows the last 3 minutes
/** The face for a hand: seconds to midnight on a 3-minute quarter face, the Bulletin's 85 s as a ghost tick. */
export function clockFace(h: Hand, pin: number, labels = true) {
  return face({ minutes: h.seconds / UNIT, range: h.range ? [h.range[0] / UNIT, h.range[1] / UNIT] : undefined, ghost: h.source === 'forecast' ? pin / UNIT : h.source === 'simulated' ? (h.ghost ?? pin) / UNIT : undefined,
    labels, marks: [[5, '1 min'], [10, '2 min'], [15, '3 min']], ghostLabel: h.source === 'simulated' ? 'Today' : `Bulletin ${pin} s`, label: `It is ${Math.round(h.seconds)} seconds to midnight` })
}
export const readingLine = (h: Hand) => (h.seconds >= FACE_SECONDS ? 'Over 3 Minutes to Midnight' : `${Math.round(h.seconds)} Seconds to Midnight`)

interface Props {
  hand: Hand
  pin: number
  daysPerSecond: number | null
  /** Today's reading: the countdown always runs to its date. */
  today: ClockReading
  isToday: boolean
  frame: WorldFrame
  prev: WorldFrame | null
  compact?: boolean
  /** Simulated frames: which future, the step, and why its hand moved. */
  sim?: { n: number; of: number; step: RecordedStep; move: Move | null; live: boolean; standIn?: boolean } | null
  onWhy: () => void
}

export function Clock({ hand, pin, daysPerSecond, today, isToday, frame, prev, compact, sim, onWhy }: Props) {
  const reading = today
  const faceRef = useRef<HTMLDivElement>(null)
  const lastMin = useRef<number | null>(null)
  const [cd, setCd] = useState(() => (today.date10 ? countdown(today.date10) : '–'))
  const [open, setOpen] = useState(false)
  // A new step opens 'why the hand moved' for about 4 s while it plays.
  const stepNo = sim?.step.step, autoOpen = !!sim?.live
  useEffect(() => {
    if (!stepNo || !autoOpen) return
    setOpen(true)
    const t = setTimeout(() => setOpen(false), 4000)
    return () => clearTimeout(t)
  }, [stepNo, autoOpen, sim?.n])
  useEffect(() => { if (!sim) setOpen(false) }, [sim])

  useEffect(() => {
    if (!today.date10) return
    const t = setInterval(() => setCd(countdown(today.date10!)), 1000)
    return () => clearInterval(t)
  }, [today.date10])

  // The hand sweeps once per change, 600 ms, from where it was (it jumps with reduced motion).
  const minutes = hand.seconds / UNIT
  useLayoutEffect(() => {
    const svg = faceRef.current?.querySelector('svg')
    const handEl = svg?.querySelector<SVGElement>('.hand')
    const from = lastMin.current
    lastMin.current = minutes
    if (!svg || !handEl || from == null || from === minutes || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    handEl.style.transform = `rotate(${-(Math.min(15, from) - Math.min(15, minutes)) * 6}deg)`
    void handEl.getBoundingClientRect()
    svg.classList.add('sweep')
    handEl.style.transform = ''
  }, [minutes])

  const moved = movedSummary(prev, frame)
  return (
    <>
      <section id="clock" className={`dc-panel dc-clock${compact ? ' compact' : ''}`} role="button" tabIndex={0} aria-label={sim ? 'Doom Clock, simulated future. Open: why this time?' : 'Doom Clock, real forecast. Open: why this time?'}
        onClick={onWhy} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onWhy())}>
        <div className="cap">
          {sim ? <Label kind="simulated">Future {sim.n} of {sim.of} · {sim.standIn ? 'illustrative stand-in' : 'simulated'} · {half(frame.start)}</Label>
            : hand.source === 'bulletin' && !isToday ? <Label kind="real">Bulletin, {qName(frame.quarter)}</Label> : <Label kind="real">Real forecast</Label>}
          <span className="dc-faint">{sim || (hand.source === 'bulletin' && !isToday) ? '' : daysPerSecond ? `1 s ≈ ${Math.round(daysPerSecond)} days` : ''}</span>
        </div>
        <div className="face" ref={faceRef} dangerouslySetInnerHTML={{ __html: clockFace(hand, pin) }} />
        <p className="reading">{readingLine(hand)}</p>
        {sim ? <div className="cd sim-date">1 in 10 by {frame.clock?.date10 ? monthYear(frame.clock.date10) : 'after 2100'}</div> : <div className="cd" aria-live="off">{cd}</div>}
        {sim && (
          <button className="movedline" onClick={(e) => (e.stopPropagation(), setOpen(!open))} aria-expanded={open} aria-controls="moved">
            {sim.move ? <>Step {sim.step.step} moved the hand <b className={sim.move.months < 0 ? 'toward' : 'away'}>{mths(sim.move.months)} {sim.move.months < 0 ? 'toward' : 'away from'} midnight</b></> : `Step ${sim.step.step}`} ›
          </button>
        )}
        {!sim && moved && (
          <button className="movedline" onClick={(e) => (e.stopPropagation(), setOpen(!open))} aria-expanded={open} aria-controls="moved">
            {moved.days === 0 ? 'No market moved since ' : 'Forecast moved '}
            {moved.days !== 0 && <b className={moved.days < 0 ? 'toward' : 'away'}>{months(moved.days)} {moved.days < 0 ? 'toward' : 'away from'} midnight</b>}
            {moved.days !== 0 ? ' since ' : ''}{qName(prev!.quarter)} ›
          </button>
        )}
        {!compact && (sim ? <div className="to">Today: <b>{reading.date10 ? dmy(reading.date10) : 'after 2100'}</b> (ghost hand). A scenario, not a prediction.</div> :
          hand.source === 'bulletin' && !isToday && frame.clock?.date10
            ? <div className="to">Our forecast then: 1 in 10 by <b>{dmy(frame.clock.date10)}</b>. Today: <b>{reading.date10 ? dmy(reading.date10) : 'after 2100'}</b></div>
            : <div className="to">until <b>{reading.date10 ? dmy(reading.date10) : 'after 2100'}</b>, when the chance of AI catastrophe passes 1 in 10</div>
        )}
        <span className="why">Why this time?</span>
      </section>
      {sim?.move && open && <SimMoved sim={sim as NonNullable<typeof sim> & { move: Move }} onClose={() => setOpen(false)} />}
      {!sim && moved && open && <Moved prev={prev!} frame={frame} days={moved.days} onClose={() => setOpen(false)} />}
    </>
  )
}

const half = (start: string) => `${start.slice(0, 4)} H${+start.slice(5, 7) < 7 ? 1 : 2}`
const mths = (m: number) => { const a = Math.abs(m); return `${a < 10 ? a.toFixed(1) : Math.round(a)} month${a === 1 ? '' : 's'}` }
const months = (days: number) => {
  const m = Math.abs(days) / 30.44
  return m < 1 ? `${Math.round(Math.abs(days))} days` : `${m.toFixed(m < 10 ? 1 : 0)} months`
}

function movedSummary(prev: WorldFrame | null, cur: WorldFrame) {
  if (!prev?.clock?.date10 || !cur.clock?.date10) return null
  return { days: (Date.parse(cur.clock.date10) - Date.parse(prev.clock.date10)) / 864e5 }
}

const CONTEXT_KINDS = new Set(['government', 'news'])
function contextEvents(f: WorldFrame): WorldEvent[] {
  const ev = f.events.filter((e) => e.provenance === 'real' && CONTEXT_KINDS.has(e.kind))
  return [...ev.filter((e) => e.major), ...ev.filter((e) => !e.major)].slice(0, 2)
}

function Moved({ prev, frame, days, onClose }: { prev: WorldFrame; frame: WorldFrame; days: number; onClose: () => void }) {
  const dir = days < 0 ? 'toward' : 'away'
  const ctx = contextEvents(frame)
  return (
    <section id="moved" className="dc-panel on" aria-label="Why the hand moved">
      <div className="mh"><b className="cap-t">Why the hand moved</b><button aria-label="Hide" onClick={onClose}>×</button></div>
      {frame.drivers.length === 0 ? (
        <p className="mt">No market moved. The predicted date is the same; the hand advances because {qName(frame.quarter)} is later than {qName(prev.quarter)}.</p>
      ) : (
        <p className="mt">
          <span className={dir}>{months(days)} {dir === 'toward' ? 'toward' : 'away from'} midnight</span> between {dmy(prev.start)} and {dmy(frame.start)}: the 1-in-10 date moved from {monthYear(prev.clock!.date10!)} to {monthYear(frame.clock!.date10!)}.
        </p>
      )}
      {frame.drivers.slice(0, 3).map((d) => (
        <div className="drv" key={d.anchorId}>
          <a href={d.url} target="_blank" rel="noopener">Manifold: {d.label} {Math.round(d.from * 100)}% → {Math.round(d.to * 100)}%</a>
          <span className={d.effectDays < 0 ? 'toward' : 'away'}>{d.effectDays < 0 ? '−' : '+'}{months(d.effectDays)}</span>
          <span className="dc-data">moved {dmy(d.ts)} · {d.traders} traders</span>
        </div>
      ))}
      {frame.drivers.length > 0 && Math.abs(frame.residualDays) >= 1 && (
        <div className="drv"><span className="dc-faint">Other: overlap between the moves, and the forecast restarting later</span><span className="dc-faint">{frame.residualDays < 0 ? '−' : '+'}{months(frame.residualDays)}</span></div>
      )}
      {ctx.length > 0 && (
        <div className="ctx">
          <b className="cap-t dc-faint">Around the same time</b>
          {ctx.map((e) => (
            <div key={e.ts + e.title}><span className="dc-data">{dmy(e.ts)}</span> {e.title.length > 100 ? e.title.slice(0, 100) + '…' : e.title} · {e.url ? <a href={e.url} target="_blank" rel="noopener">{sourceName(e.source)} ↗</a> : sourceName(e.source)}</div>
          ))}
          <span className="dc-faint">Context, not causes. Only market prices move the hand. Effects assume the 3-year gap <Label kind="game-rule" /></span>
        </div>
      )}
    </section>
  )
}

function SimMoved({ sim, onClose }: { sim: NonNullable<Props['sim']> & { move: Move }; onClose: () => void }) {
  const { step, move } = sim
  const top = [...step.events].sort((a, b) => Math.abs(Object.values(b.effect?.dlogit ?? {}).reduce((s, v) => s + Math.abs(v ?? 0), 0)) - Math.abs(Object.values(a.effect?.dlogit ?? {}).reduce((s, v) => s + Math.abs(v ?? 0), 0))).slice(0, 2)
  return (
    <section id="moved" className="dc-panel on" aria-label="Why the hand moved">
      <div className="mh"><b className="cap-t">Why the hand moved</b><button aria-label="Hide" onClick={onClose}>×</button></div>
      <p className="mt"><span className={move.months < 0 ? 'toward' : 'away'}>{mths(move.months)} {move.months < 0 ? 'toward' : 'away from'} midnight</span> in step {step.step}, {dmy(step.start)} to {dmy(step.end)}. A scenario, not a prediction.</p>
      {move.rows.filter((r) => move.split || r.key !== 'report').map((r) => (
        <div className="drv" key={r.key}><span>{r.label} {r.rule && <Label kind="game-rule" />}</span><span className={r.months < 0 ? 'toward' : 'away'}>{Math.abs(r.months) < 0.05 ? '0' : `${r.months < 0 ? '−' : '+'}${mths(r.months)}`}</span></div>
      ))}
      {!move.split && <div className="drv"><span className="dc-faint">Events and situation report, together</span><span>{move.rows[0].months < 0 ? '−' : '+'}{mths(move.rows[0].months)}</span></div>}
      <div className="ctx">
        <span>{step.summary}</span>
        {top.map((e) => <div key={e.ts + e.title}><span className="dc-data">{dmy(e.ts)}</span> {e.title.length > 90 ? e.title.slice(0, 90) + '…' : e.title}</div>)}
        <span className="dc-faint">How much each event moves the odds is our rule, not data <Label kind="game-rule" />. Simulated by MiroFish <Label kind="simulated" /></span>
      </div>
    </section>
  )
}
