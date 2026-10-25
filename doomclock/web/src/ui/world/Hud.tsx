// The World HUD around the globe: the watched future (top-right), the ticker over the time spine
// (bottom), the newsflash for turning points, the event popover and the map key.
import { useRef, useState } from 'react'
import type { SampledFuture, WorldEvent, WorldFrame } from '../../contracts.ts'
import { dmy, fmt, monthYear, qName, sourceName } from '../format.ts'
import type { Located } from './locate.ts'
import { Label, labelOf } from '../Label.tsx'

export const isReal = (e: WorldEvent) => e.provenance === 'real'
interface AvatarRef { id: string; file: string; aliases: string[] }
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
/** The event's account avatar (a simulated poster's handle) or its source's (AIID, GOV.UK...). */
const avatarFor = (e: WorldEvent, avatars: AvatarRef[]) =>
  avatars.find((a) => (e.who && a.aliases?.includes(e.who)) || a.id === slug(sourceName(e.source)))

export const PICKS = [['Early', 0.1], ['Typical', 0.5], ['Late', 0.9]] as const

export function FutureChip({ future, onPick, onRoll }: { future: SampledFuture; onPick: (q: number) => void; onRoll: () => void }) {
  const later = Math.round((1 - future.percentile - 1e-4) * 100)
  return (
    <section id="future" className="dc-panel" aria-label="Watched future">
      <div className="t"><b>Future #{fmt(future.id)}</b><span className="dc-faint">of 10,000</span></div>
      <div className="dc-dim">{future.catDate ? `Earlier than ${later}% of futures.` : 'No catastrophe by 2100, like most futures.'}</div>
      <div className="ms">
        <div><span className="dc-dim">Superintelligence</span><b>{future.asiDate ? monthYear(future.asiDate) : 'not by 2100'}</b></div>
        <div className={future.catDate ? '' : 'none'}><span style={future.catDate ? { color: 'var(--alarm)' } : undefined}>✕ Catastrophe</span><b>{future.catDate ? monthYear(future.catDate) : 'none by 2100'}</b></div>
      </div>
      <div className="row">
        <div className="dc-tabs">
          {PICKS.map(([t, q]) => <button key={t} aria-pressed={Math.abs(future.percentile - q) < 1e-4} onClick={() => onPick(q)}>{t}</button>)}
        </div>
        <button className="dc-btn dc-btn--outline" aria-label="Roll another future" onClick={onRoll}>Roll <kbd>R</kbd></button>
      </div>
      <span className="dc-data">sim.ts · seed 1 · path {future.id}</span>
    </section>
  )
}

export function Ticker({ events, real, note, onRead }: { events: WorldEvent[]; real: boolean; note?: string; onRead: () => void }) {
  const [index, setIndex] = useState(0)
  const ordered = [...events].sort((a, b) => Number(!!b.major) - Number(!!a.major))
  const e = ordered[index % Math.max(1, ordered.length)]
  const realEvent = e ? isReal(e) : real
  const browse = (step: number) => { onRead(); setIndex((i) => (i + step + ordered.length) % ordered.length) }
  return (
    <section className="dc-ticker event-reader" id="ticker" aria-label="Quarter events" onClick={onRead}>
      <div className="event-meta">
        <Label kind={e ? labelOf(e.provenance) : real ? 'real' : 'projected'}>{realEvent ? 'Real news' : undefined}</Label>
        {e && !note && <><time dateTime={e.ts}>{dmy(e.ts)}</time><span>{sourceName(e.source)}{e.where ? ` · ${e.where}` : ''}{e.major ? ' · major event' : ''}</span></>}
      </div>
      <div className="event-headline" aria-live="polite">{note ?? (e ? (e.url ? <a href={e.url} target="_blank" rel="noopener">{e.title} ↗</a> : e.title) : 'No events this quarter')}</div>
      {e && !note && <div className="event-nav"><button className="dc-btn dc-btn--sm" aria-label="Previous news event" onClick={() => browse(-1)}>←</button><span className="dc-data">{index % ordered.length + 1} / {ordered.length}</span><button className="dc-btn dc-btn--sm" aria-label="Next news event" onClick={() => browse(1)}>→</button></div>}
      {e?.detail && !note && <details className="event-detail" onToggle={(ev) => { if (ev.currentTarget.open) onRead() }}><summary>Read context · pauses replay</summary><p>{e.detail}</p>{e.who && <p>{e.who}</p>}</details>}
    </section>
  )
}

interface SpineProps { frames: WorldFrame[]; cur: number; today: number; future: SampledFuture; onScrub: (i: number) => void }
const frameOf = (frames: WorldFrame[], t: string | null) => (t ? frames.findIndex((f, k) => Date.parse(t) >= Date.parse(f.start) && (k === frames.length - 1 || Date.parse(t) < Date.parse(frames[k + 1].start))) : -1)

/** The Bulletin's spine on its side: solid ink to today, dashed sim after, one big year at a time. */
export function Spine({ frames, cur, today, future, onScrub }: SpineProps) {
  const el = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)
  const n = frames.length - 1
  const pos = (i: number) => `${(i / n) * 100}%`
  const ai = frameOf(frames, future.asiDate), ci = frameOf(frames, future.catDate)
  const keyYears = new Set([ai > today ? frames[ai].quarter.slice(0, 4) : '', ci > today ? frames[ci].quarter.slice(0, 4) : ''])
  const at = (x: number) => { const r = el.current!.getBoundingClientRect(); return Math.max(0, Math.min(n, Math.round(((x - r.left) / r.width) * n))) }
  const near = (i: number) => Math.abs(i - cur) < 7
  const pc = (cur / n) * 100
  const q = frames[cur].quarter
  return (
    <div className={`dc-spine${drag ? ' drag' : ''}`} id="scrub" ref={el} role="slider" tabIndex={0} aria-label="Quarter" aria-valuemin={0} aria-valuemax={n} aria-valuenow={cur} aria-valuetext={qName(q)}
      onPointerDown={(e) => { setDrag(true); el.current!.setPointerCapture(e.pointerId); onScrub(at(e.clientX)) }}
      onPointerMove={(e) => drag && onScrub(at(e.clientX))} onPointerUp={() => setDrag(false)}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') onScrub(Math.min(n, cur + 1)); if (e.key === 'ArrowLeft') onScrub(Math.max(0, cur - 1)) }}>
      <div className="axis" style={{ width: pos(today) }} />
      <div className="proj" style={{ left: pos(today) }} />
      {ci > today && <div className="ended" style={{ left: pos(ci) }} />}
      {frames.map((f, i) => f.quarter.endsWith('Q1') && (
        <span key={f.quarter}>
          <div className={`node${keyYears.has(f.quarter.slice(0, 4)) ? ' key' : ''}`} style={{ left: pos(i) }} />
          <div className={`yr${keyYears.has(f.quarter.slice(0, 4)) ? ' key' : ''}`} style={{ left: pos(i) }}>{f.quarter.slice(0, 4)}</div>
        </span>
      ))}
      <div className="node today" style={{ left: pos(today) }} />
      {!near(today) && <div className="tag today" style={{ left: pos(today) }}>Today</div>}
      {ai > today && <div className="node key" style={{ left: pos(ai) }} title={`This future: superintelligence, ${monthYear(future.asiDate!)}`} />}
      {ci > today && <><div className="node end" style={{ left: pos(ci) }} title={`This future: catastrophe, ${monthYear(future.catDate!)}`} />
        {!near(ci) && <div className="tag cat" style={{ left: pos(ci) }}>✕ Catastrophe, this future</div>}</>}
      <div className="node on" style={{ left: `${pc}%` }} />
      <div className="big" style={{ left: `${pc}%`, transform: `translateX(-${pc}%)` }}><small>{q.slice(4)}{cur === today ? ' · today' : ''}</small>{q.slice(0, 4)}</div>
    </div>
  )
}

export interface Flash { sim: boolean; band: string; quarter: string; title: string; detail: string; source?: { name: string; url?: string }; label: 'real' | 'sim' | null }

/** Turning points only; closes itself after 4 s (hover pauses), never needs an OK. */
export function Newsflash({ flash, onDone }: { flash: Flash | null; onDone: () => void }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!flash) return <section id="flash" className="dc-flash" role="status" aria-live="polite" />
  return (
    <section id="flash" key={flash.title + flash.quarter} className={`dc-flash on${reduced ? '' : ' run'}${flash.sim ? ' sim' : ''}`} role="status" aria-live="polite" onClick={(e) => !(e.target as HTMLElement).closest('a') && onDone()}>
      <div className="band"><span>{flash.band}</span><span>{flash.quarter}</span></div>
      <div className="body">
        <h3>{flash.title}</h3>
        <p>{flash.detail}</p>
        {flash.label && <div className="shift"><Label kind={flash.label === 'real' ? 'real' : 'simulated'} /></div>}
        {flash.source && <div className="fsrc dc-data">{flash.source.url ? <a href={flash.source.url} target="_blank" rel="noopener">{flash.source.name} ↗</a> : flash.source.name}</div>}
      </div>
      <div className="timer"><i onAnimationEnd={onDone} /></div>
    </section>
  )
}

/** Who, what, where, when, source and label for one event on the map. */
export function EventPop({ e, anchor, where, avatars = [], onClose }: { e: Located; anchor: HTMLElement; where: string; avatars?: AvatarRef[]; onClose: () => void }) {
  const r = anchor.getBoundingClientRect()
  const real = isReal(e)
  const av = avatarFor(e, avatars)
  return (
    <div id="pop" className="dc-panel on" role="dialog" style={{ left: Math.min(innerWidth - 316, r.right + 10), top: Math.max(16, Math.min(innerHeight - 380, r.top - 20)) }} onClick={(ev) => ev.stopPropagation()}>
      <div className="h">{av && <img className="av" src={`avatars/${av.file}`} alt="" />}<Label kind={labelOf(e.provenance)} /><span className="dc-data">{dmy(e.ts)}</span><button className="x" aria-label="Close" onClick={onClose}>×</button></div>
      <p>{e.detail ?? e.title}</p>
      <dl>
        {e.who && <><dt>Who</dt><dd>{e.who}</dd></>}
        <dt>Where</dt><dd>{where}</dd>
        <dt>When</dt><dd>{dmy(e.ts)}</dd>
        <dt>Source</dt><dd>{e.url ? <a href={e.url} target="_blank" rel="noopener">{sourceName(e.source)} ↗</a> : sourceName(e.source)}</dd>
      </dl>
      {!real && <div className="dc-faint">{e.source === 'engine' ? 'A projected incident: the engine resampled a real AIID incident at its base rate.' : 'Simulated by MiroFish.'}</div>}
    </div>
  )
}

export function MapKey() {
  return (
    <div id="keypop" className="pop dc-panel on" role="dialog" aria-label="Map key">
      <div className="dc-marks">
        <div className="dc-mark"><span className="event-key kind-incident">!</span><span><b>Incident</b>: a reported AI harm</span></div>
        <div className="dc-mark"><span className="event-key kind-government">§</span><span><b>Government</b>: a public decision or action</span></div>
        <div className="dc-mark"><span className="event-key kind-news">≋</span><span><b>News</b>: a dated report or clock statement</span></div>
        <div className="dc-mark"><span className="event-key kind-post">@</span><span><b>X post</b>: a simulated society post</span></div>
        <div className="dc-mark"><svg viewBox="0 0 40 28"><circle className="k-land1" cx="5" cy="14" r="3.4" /><circle className="k-land2" cx="20" cy="14" r="3.4" /><circle className="k-land3" cx="35" cy="14" r="3.4" style={{ fill: 'var(--ink-2)' }} /></svg><span><b>Land dots</b>, brighter where this future has more frontier AI activity <span className="dc-mock">mock split</span></span></div>
        <div className="dc-mark"><svg viewBox="0 0 40 28"><circle className="k-real" cx="20" cy="14" r="9" /></svg><span><b>Solid ring</b>: a real event before today</span></div>
        <div className="dc-mark"><svg viewBox="0 0 40 28"><circle className="k-sim" cx="20" cy="14" r="9" /></svg><span><b>Dashed ring</b>: simulated or projected after today. Click to read it</span></div>
        <div className="dc-mark"><svg viewBox="0 0 40 28"><circle className="k-dot0" cx="20" cy="14" r="3" style={{ fill: 'var(--ink-2)' }} /></svg><span><b>Grey dot</b>: a publicly mapped datacentre site (Epoch AI), not compute share</span></div>
        <div className="dc-mark"><svg viewBox="0 0 40 28"><rect className="k-cat" x="14" y="8" width="12" height="12" transform="rotate(45 20 14)" /></svg><span><b>Red</b>: catastrophe, in this one future</span></div>
        <div className="dc-mark"><svg viewBox="0 0 40 28"><circle className="k-cat" cx="20" cy="14" r="8" style={{ opacity: 0.5 }} /></svg><span><b>Red glow</b> around datacentres shows how close the clock is to midnight, not where harm happens</span></div>
      </div>
    </div>
  )
}
