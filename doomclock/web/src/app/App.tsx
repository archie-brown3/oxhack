// Phase 1: the World screen with the clock, Inputs and Why this time? (with Track record).
// Renders the engine's Timeline and ClockReading (contracts.ts); never game state.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WorldEvent, WorldFrame } from '../contracts.ts'
import { buildTimeline, PICKS, type Pick } from '../engine/timeline.ts'
import { backtest } from '../fixtures/backtest.ts'
import { Clock } from '../ui/clock/Clock.tsx'
import { bulletinAt, scaleOf } from '../ui/clock/scale.ts'
import { dmy, monthYear, qName, sourceName } from '../ui/format.ts'
import { InputsSheet } from '../ui/inputs/InputsSheet.tsx'
import { WhySheet, type WhyTab } from '../ui/why/WhySheet.tsx'
import { EngineScreen, type Member } from '../ui/engine/EngineScreen.tsx'
import { GlobeView, locate, type Flare, type Located } from '../ui/world/Globe.tsx'
import { EventPop, FutureChip, MapKey, Newsflash, Spine, Ticker, type Flash } from '../ui/world/Hud.tsx'
import { countryAt, countryName, load, type Data } from './data.ts'

const params = new URLSearchParams(location.search)
const QMS = 8000 // one quarter at 1x: time to read the event before the next quarter
const initialPick = (): Pick => { const f = params.get('fut'); return f && /^\d+$/.test(f) ? { seed: +f } : { percentile: PICKS[f as keyof typeof PICKS] ?? PICKS.early } }

export function App() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { load().then(setData, (e) => setErr(String(e))) }, [])
  if (err) return <main className="fail">Couldn't load the data: {err}</main>
  if (!data) return <main className="fail" aria-busy="true">Loading the world…</main>
  return <World data={data} />
}

function World({ data }: { data: Data }) {
  const { world, bulletin, countries, centroids } = data
  const [pick, setPick] = useState<Pick>(initialPick)
  const timeline = useMemo(() => buildTimeline(world, pick), [world, pick])
  const frames = timeline.frames
  const today = frames.findLastIndex((f) => f.provenance === 'real')
  const scale = useMemo(() => scaleOf(timeline, bulletin), [timeline, bulletin])
  const [cur, setCur] = useState(() => (params.has('q') ? +params.get('q')! : today))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [live, setLive] = useState(false) // quarters advance by play or step: ping and flash
  const [sheet, setSheet] = useState<null | 'inputs' | 'why'>(() => (params.get('sheet') === 'none' || params.has('q') ? (params.get('sheet') as 'why' | null) ?? null : 'inputs'))
  const [whyTab, setWhyTab] = useState<WhyTab>((params.get('tab') as WhyTab) ?? 'anchors')
  const [flashes, setFlashes] = useState<Flash[]>([])
  const [flare, setFlare] = useState<Flare | null>(null)
  const [focus, setFocus] = useState<[number, number] | null>(null)
  const [pop, setPop] = useState<{ e: Located; anchor: HTMLElement } | null>(null)
  const [keyOpen, setKeyOpen] = useState(false)
  const [coach, setCoach] = useState<{ text: string; skip?: boolean } | null>(null)
  const intro = useRef(false)
  const [view, setView] = useState<'world' | 'engine'>(params.get('view') === 'engine' ? 'engine' : 'world')
  const [maxed, setMaxed] = useState<'graph' | 'cast' | null>(null)
  const [liveRun, setLiveRun] = useState<{ t0: number; shown: number } | null>(() => (params.has('live') ? { t0: Date.now(), shown: +params.get('live')! || 0 } : null))
  // The five representative futures MiroFish runs a society for (task 11).
  const ensemble = useMemo<Member[]>(() => [0.05, 0.1, 0.25, 0.5, 0.9].map((q, i) => ({ k: i + 1, q, future: buildTimeline(world, { percentile: q }).future })), [world])
  // Recorded replay: one quarter's posts stream in, about one post a second (task 19).
  useEffect(() => {
    if (!liveRun || liveRun.shown >= 30) return
    const t = setTimeout(() => setLiveRun((l) => l && { ...l, shown: l.shown + 1 }), 1100)
    return () => clearTimeout(t)
  }, [liveRun])

  const frame = frames[cur]
  const isToday = cur === today
  const hand = scale.hand(frame, isToday)
  const frameEnd = Date.parse(frame.start) + 92 * 864e5
  const catT = timeline.future.catDate ? Date.parse(timeline.future.catDate) : Infinity
  const ended = cur > today && catT < frameEnd
  const afterEnd = cur > today && catT < Date.parse(frame.start)
  const located = useMemo(() => frame.events.map((e) => locate(e, centroids)).filter((e): e is Located => !!e), [frame, centroids])

  // Turning points for a quarter: the Bulletin's settings, major events, today, and this future's milestones.
  const flashesFor = useCallback((f: WorldFrame, k: number): Flash[] => {
    const out: Flash[] = [], s = Date.parse(f.start), e = s + 92 * 864e5, q = qName(f.quarter)
    for (const b of bulletin) if (Date.parse(b.ts) >= s && Date.parse(b.ts) < e && k <= today)
      out.push({ sim: false, band: 'On the record', quarter: q, title: `The Doomsday Clock moves to ${b.seconds_to_midnight} seconds`, detail: `Bulletin of the Atomic Scientists, Chicago · ${dmy(b.ts)}. ${b.reason.split('.')[0]}.`, source: { name: 'thebulletin.org', url: b.url }, label: 'real' })
    for (const ev of f.events) if (ev.major && ev.provenance === 'real' && ev.source !== 'bulletin' && !/Doomsday Clock/.test(ev.title))
      out.push({ sim: false, band: 'Major event', quarter: q, title: ev.title.length > 90 ? ev.title.slice(0, 88) + '…' : ev.title, detail: ev.detail ?? `${ev.who ?? sourceName(ev.source)} · ${dmy(ev.ts)}`, source: { name: sourceName(ev.source), url: ev.url }, label: 'real' })
    if (k === today) out.push({ sim: false, band: 'Today', quarter: q, title: 'The real record ends here', detail: 'From here on you are watching one of 10,000 simulated futures. The clock is the real forecast, and no future moves it.', label: null })
    const fut = timeline.future, inF = (t: string | null) => t != null && Date.parse(t) >= s && Date.parse(t) < e
    if (k > today && inF(fut.asiDate)) out.push({ sim: true, band: 'Turning point', quarter: q, title: `A lab builds superintelligence, ${monthYear(fut.asiDate!)}`, detail: 'In this future. The date is drawn from the market curve behind the clock.', source: { name: `sim.ts · seed 1 · path ${fut.id}` }, label: 'sim' })
    if (k > today && inF(fut.catDate)) out.push({ sim: true, band: 'Catastrophe · this future', quarter: q, title: `AI catastrophe, ${monthYear(fut.catDate!)}`, detail: `One sampled future, not the forecast: by this quarter ${Math.round(f.pCat * 100)}% of all 10,000 futures have gone wrong.`, source: { name: `sim.ts · seed 1 · path ${fut.id}` }, label: 'sim' })
    return out
  }, [bulletin, today, timeline])

  const go = useCallback((k: number, isLive: boolean) => {
    const i = Math.max(0, Math.min(frames.length - 1, k))
    setCur(i); setLive(isLive); setPop(null)
    if (isLive) setFlashes(flashesFor(frames[i], i))
  }, [frames, flashesFor])

  // A major event flares its country and turns the globe to it.
  const flash = flashes[0] ?? null
  useEffect(() => {
    if (!flash) return
    const ev = frame.events.find((e) => e.major && flash.title.startsWith(e.title.slice(0, 40)))
    if (ev?.where) { setFlare({ iso3: [ev.where], sim: flash.sim }); const c = centroids.get(ev.where); if (c) setFocus(c) }
    else if (/Doomsday/.test(flash.title)) setFocus([41.9, -87.6])
    const t = setTimeout(() => setFlare(null), 2600)
    return () => clearTimeout(t)
  }, [flash]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play: one quarter per QMS / speed. Stops at today in the opening replay and at this future's end.
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setCur((c) => {
      const n = c + 1
      if (n >= frames.length) { setPlaying(false); return c }
      setLive(true); setPop(null); setFlashes(flashesFor(frames[n], n))
      if (n === today && intro.current) { intro.current = false; setPlaying(false); setCoach(null); setTimeout(() => setCoach({ text: 'Press Space to play this future, or E to watch its recorded society replay' }), 4300) }
      if (n > today && catT >= Date.parse(frames[n].start) && catT < Date.parse(frames[n].start) + 92 * 864e5) setPlaying(false)
      return n
    }), QMS / speed)
    return () => clearInterval(t)
  }, [playing, speed, frames, today, catT, flashesFor])

  const play = () => { if (cur >= frames.length - 1 || afterEnd) go(today, false); setCoach(null); setPlaying(true) }
  const runLive = () => {
    const t0 = performance.now(); buildTimeline(world, pick); const ms = Math.max(1, Math.round(performance.now() - t0))
    setSheet(null); setView('world'); setLiveRun({ t0: Date.now(), shown: 0 }); intro.current = true; go(0, true); setSpeed(1); setPlaying(true)
    setCoach({ text: `Sampled 10,000 futures in ${ms} ms, in your browser. Replaying the real record to today.`, skip: true })
  }
  const skip = () => { intro.current = false; setPlaying(false); setCoach(null); go(today, true) }
  const choose = (p: Pick) => { setPick(p); setPlaying(false); setCoach(null); go(Math.min(cur, today), false) }
  const roll = () => choose({ seed: (Math.random() * 2 ** 31) | 0 })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input,textarea')) return
      if (e.key === 'Escape') { if (maxed) return setMaxed(null); setSheet(null); setPop(null); setKeyOpen(false); return }
      if (sheet) return
      const k = e.key.toLowerCase()
      if (k === 'i') setSheet('inputs')
      else if (k === 'e') setView(view === 'engine' ? 'world' : 'engine')
      else if (k === 'w') setView('world')
      else if (k === 'f' && view === 'engine') setMaxed(maxed ? null : 'graph')
      else if (k === 'r') roll()
      else if (e.key === ' ' && !(e.target as HTMLElement).closest('button,[role=button],[role=slider]')) { e.preventDefault(); if (playing) setPlaying(false); else play() }
      else if (e.key === 'ArrowRight' && !(e.target as HTMLElement).closest('[role=slider]')) { setPlaying(false); go(cur + 1, true) }
      else if (e.key === 'ArrowLeft' && !(e.target as HTMLElement).closest('[role=slider]')) { setPlaying(false); go(cur - 1, false) }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  useEffect(() => { if (params.has('flash')) setFlashes(flashesFor(frame, cur)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const whereOf = (e: WorldEvent & { lat: number; lng: number }) => countryName(countries, e.where) ?? (e.where || e.region !== 'rest' ? countryAt(countries, e.lat, e.lng) ?? 'location not stated' : 'location not stated')
  const tickerNote = afterEnd ? `This future ended in ${monthYear(timeline.future.catDate!)}. Roll another to watch a different one.` : undefined
  const setting = bulletinAt(bulletin, Date.parse(world.asOf))

  return (
    <div className={`${ended ? 'ended' : ''} ${view}`} onClick={() => { setPop(null); setKeyOpen(false) }}>
      <GlobeView hidden={view === 'engine'} countries={countries} dcs={data.dcs} frame={frame} ended={ended} events={located} spanMs={live && playing ? QMS / speed : null} flare={flare} focus={focus} rotate={!sheet && view === 'world'} onPick={(e, anchor) => setPop({ e, anchor })} />
      <div id="vignette" />
      <Clock hand={hand} pin={scale.pin} daysPerSecond={scale.daysPerSecond} today={timeline.clock} isToday={isToday} frame={frame} prev={frames[cur - 1] ?? null} onWhy={() => setSheet('why')} />
      <nav id="viewseg" className="dc-panel" aria-label="View">
        <div className="dc-tabs">
          <button aria-pressed={sheet === 'inputs'} onClick={() => setSheet('inputs')}>Inputs<kbd>I</kbd></button>
          <button aria-pressed={sheet !== 'inputs' && view === 'world'} onClick={() => { setSheet(null); setView('world') }}>World<kbd>W</kbd></button>
          <button aria-pressed={sheet !== 'inputs' && view === 'engine'} onClick={() => { setSheet(null); setView('engine') }}>Engine<kbd>E</kbd></button>
        </div>
      </nav>
      {view === 'engine' && <EngineScreen future={timeline.future} ensemble={ensemble} quarter={frame.quarter} firstSim={frames[today + 1].quarter} live={liveRun} avatars={data.avatars} maxed={maxed} onMax={setMaxed}
        onWatch={(m) => choose({ percentile: m.q })} />}
      <FutureChip future={timeline.future} onPick={(q) => choose({ percentile: q })} onRoll={roll} />
      <footer id="dock" className="dc-panel">
        <Ticker key={frame.quarter} events={afterEnd ? [] : frame.events} real={frame.provenance === 'real'} note={tickerNote} onRead={() => setPlaying(false)} />
        <div className="dc-timebar">
          <button className="dc-play" aria-label={playing ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); if (playing) setPlaying(false); else play() }}>
            <svg viewBox="0 0 14 14">{playing ? <path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" /> : <path d="M3 1.5v11l9-5.5z" />}</svg>
          </button>
          <div className="dc-tabs">{[1, 2, 4].map((s) => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>)}</div>
          <Spine frames={frames} cur={cur} today={today} future={timeline.future} onScrub={(i) => { setPlaying(false); setCoach(null); go(i, false) }} />
          <button className="dc-btn" onClick={(e) => { e.stopPropagation(); setKeyOpen(!keyOpen) }}>Map key</button>
        </div>
      </footer>
      {keyOpen && <MapKey />}
      {coach && <div id="coach" className="dc-panel">{coach.text}{coach.skip && <button className="dc-btn dc-btn--sm coach-skip" onClick={skip}>Skip</button>}</div>}
      <Newsflash flash={flash} onDone={() => setFlashes((f) => f.slice(1))} />
      {pop && <EventPop e={pop.e} anchor={pop.anchor} where={whereOf(pop.e)} onClose={() => setPop(null)} />}
      {sheet === 'inputs' && <InputsSheet world={world} dcs={data.dcs} worldSource={data.worldSource} onRun={runLive} onClose={() => setSheet(null)} />}
      {sheet === 'why' && <WhySheet world={world} timeline={timeline} hand={scale.hand(frames[today], true)} pin={scale.pin} daysPerSecond={scale.daysPerSecond} backtest={backtest} tab={whyTab} onTab={setWhyTab} onClose={() => setSheet(null)} />}
      <span className="sr-only" aria-live="polite">{setting ? `The Bulletin stands at ${setting.seconds_to_midnight} seconds.` : ''}</span>
    </div>
  )
}
