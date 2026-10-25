// Phase 1: the World screen with the clock, Inputs and Why this time? (with Track record).
// Renders the engine's Timeline and ClockReading (contracts.ts); never game state.
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { WorldEvent, WorldFrame } from '../contracts.ts'
import { buildTimeline } from '../engine/index.ts'
import { isSecondQuarter, luckShare, moveOf, stepAt, truncate } from './futures.ts'
import { Clock } from '../ui/clock/Clock.tsx'
import { bulletinAt, closeness, scaleOf } from '../ui/clock/scale.ts'
import { dmy, qName, sourceName } from '../ui/format.ts'
import { InputsSheet } from '../ui/inputs/InputsSheet.tsx'
import { WhySheet, type WhyTab } from '../ui/why/WhySheet.tsx'
import { locate, type Flare, type Located } from '../ui/world/locate.ts'
import { NewsFeed, FeedPage, type FeedPost } from '../ui/world/NewsFeed.tsx'
import { EventPop, FutureSwitcher, Legend, Newsflash, Spine, Ticker, type Flash } from '../ui/world/Hud.tsx'
import { backtest } from '../fixtures/backtest.ts'
import { countryAt, countryName, load, loadTrack, type Data } from './data.ts'
import { Tour, tourDone } from './Tour.tsx'
import { liveMode } from '../ui/engine/live.ts'
import { tourSteps } from './tourSteps.tsx'

// The globe (three.js) and the Engine screen load in their own chunks, so the clock paints first.
// The globe chunk starts downloading at once, alongside the data.
const globeChunk = import('../ui/world/Globe.tsx')
const GlobeView = lazy(() => globeChunk.then((m) => ({ default: m.GlobeView })))
const EngineScreen = lazy(() => import('../ui/engine/EngineScreen.tsx').then((m) => ({ default: m.EngineScreen })))

const params = new URLSearchParams(location.search)
// Local live demo (task 156): ?live=1 / ?live=report on localhost only; null everywhere else, so production is inert.
const liveDemo = liveMode(new URL(location.href))
const STEP_MS = 5000 // one simulated step (6 months): time to read its events before the next
const FIRST_MS = 1200 // today to the first step, so the first step lands at once

export function App() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { load().then(setData, (e) => setErr(String(e))) }, [])
  if (err) return <main className="fail">Couldn't load the data: {err}</main>
  if (!data) return <main className="fail" aria-busy="true">Loading the world…</main>
  return <World data={data} />
}

function World({ data }: { data: Data }) {
  const { world, bulletin, countries, centroids, futures } = data
  const [fi, setFi] = useState(() => { const f = +(params.get('fut') ?? 1); return Number.isInteger(f) && f >= 1 && f <= futures.length ? f - 1 : 0 })
  const timeline = useMemo(() => truncate(buildTimeline(world, { percentile: 0.5 }, futures[fi])), [world, futures, fi])
  const frames = timeline.frames
  const today = frames.findLastIndex((f) => f.provenance === 'real')
  const scale = useMemo(() => scaleOf(timeline, bulletin), [timeline, bulletin])
  const [cur, setCur] = useState(() => (params.has('q') ? Math.min(+params.get('q')!, frames.length - 1) : today))
  const [playing, setPlaying] = useState(false)
  const [live, setLive] = useState(false) // quarters advance by play or step: ping and flash
  // The globe and clock come first; the walkthrough opens Inputs as its second step.
  const [sheet, setSheet] = useState<null | 'inputs' | 'why'>(() => (['inputs', 'why'] as const).find((s) => s === params.get('sheet')) ?? null)
  // First launch (no deep link) or ?tour: the walkthrough. "Show me around" replays it.
  const [touring, setTouring] = useState(() => params.has('tour') || (!params.size && !tourDone()))
  // The walkthrough's last step quotes the backtest's headline once it has loaded.
  const [trackHeadline, setTrackHeadline] = useState<string | null>(null)
  useEffect(() => { if (touring) loadTrack().then((t) => setTrackHeadline(t.bt?.headline.text ?? null)) }, [touring])
  const [whyTab, setWhyTab] = useState<WhyTab>((['when', 'danger', 'track'] as const).find((t) => t === params.get('tab')) ?? 'when')
  const [flashes, setFlashes] = useState<Flash[]>([])
  const [flare, setFlare] = useState<Flare | null>(null)
  const [focus, setFocus] = useState<[number, number] | null>(null)
  const [pop, setPop] = useState<{ e: Located; anchor: HTMLElement } | null>(null)
  const [view, setView] = useState<'world' | 'engine'>(params.get('view') === 'engine' || liveDemo ? 'engine' : 'world')
  const [feedOpen, setFeedOpen] = useState(false)
  const [maxed, setMaxed] = useState<'graph' | 'cast' | null>(null)
  // The Engine screen (owner redesign in progress) still takes its old props.

  const frame = frames[cur]
  const future = futures[fi]
  const step = frame.provenance === 'simulated' ? stepAt(future, frame.start) : null
  const isToday = cur === today
  const hand = scale.hand(frame, isToday)
  // A step lands as a whole: its events ping and read together, whichever of its two quarters is shown.
  const shown = step ? step.events : frame.events
  const located = useMemo(() => shown.map((e) => locate(e, centroids)).filter((e): e is Located => !!e), [shown, centroids])
  const move = useMemo(() => (step ? moveOf(world, future, step, timeline.clock.date10) : null), [world, future, step, timeline])
  const luck = useMemo(() => luckShare(futures), [futures])

  // The feed: real events up to this quarter (never past today), then each simulated step that has landed.
  const feed = useMemo(() => {
    const real = frames.slice(0, Math.min(cur, today) + 1).flatMap((f) => f.events.filter((e) => e.provenance === 'real'))
    const n = step?.step ?? 0
    const steps = future.steps.filter((x) => x.step <= n)
    return { events: [...real, ...steps.flatMap((x) => x.events)], posts: steps.flatMap((x) => x.topPosts.map((p): FeedPost => ({ ...p, step: x.step }))) }
  }, [frames, cur, today, step, future])

  // Turning points for a quarter: the Bulletin's settings, major real events, today, and one simulated event per step.
  const flashesFor = useCallback((f: WorldFrame, k: number): Flash[] => {
    const out: Flash[] = [], s = Date.parse(f.start), e = s + 92 * 864e5, q = qName(f.quarter)
    for (const b of bulletin) if (Date.parse(b.ts) >= s && Date.parse(b.ts) < e && k <= today)
      out.push({ sim: false, band: 'On the record', quarter: q, title: `The Doomsday Clock moves to ${b.seconds_to_midnight} seconds`, detail: `Bulletin of the Atomic Scientists, Chicago · ${dmy(b.ts)}. ${b.reason.split('.')[0]}.`, source: { name: 'thebulletin.org', url: b.url }, label: 'real' })
    for (const ev of f.events) if (ev.major && ev.provenance === 'real' && ev.source !== 'bulletin' && !/Doomsday Clock/.test(ev.title))
      out.push({ sim: false, band: 'Major event', quarter: q, title: ev.title.length > 90 ? ev.title.slice(0, 88) + '…' : ev.title, detail: ev.detail ?? `${ev.who ?? sourceName(ev.source)} · ${dmy(ev.ts)}`, source: { name: sourceName(ev.source), url: ev.url }, label: 'real' })
    if (k === today) out.push({ sim: false, band: 'Today', quarter: q, title: 'The real record ends here', detail: 'From here on you are watching a simulated future, a scenario and not a prediction. Nothing moves the real clock.', label: null })
    const st = f.provenance === 'simulated' ? stepAt(future, f.start) : null
    if (st && isSecondQuarter(st, f.start)) {
      const size = (x: WorldEvent) => Object.values(x.effect?.dlogit ?? {}).reduce((a, v) => a + Math.abs(v ?? 0), 0)
      const top = [...st.events].sort((a, b) => size(b) - size(a))[0]
      if (top) out.push({ sim: true, band: `Simulated · step ${st.step}`, quarter: q, title: top.title.length > 90 ? top.title.slice(0, 88) + '…' : top.title, detail: top.detail ?? `${top.who ?? 'MiroFish'} · ${dmy(top.ts)}`, source: { name: `MiroFish · future ${fi + 1}` }, label: 'sim' })
    }
    return out
  }, [bulletin, today, future, fi])

  const go = useCallback((k: number, isLive: boolean) => {
    const i = Math.max(0, Math.min(frames.length - 1, k))
    setCur(i); setLive(isLive); setPop(null)
    if (isLive) setFlashes(flashesFor(frames[i], i))
  }, [frames, flashesFor])

  // A major event flares its country and turns the globe to it.
  const flash = flashes[0] ?? null
  useEffect(() => {
    if (!flash) return
    const ev = frame.events.find((e) => (e.major || e.source === 'mirofish') && flash.title.startsWith(e.title.slice(0, 40)))
    if (ev?.where) { setFlare({ iso3: [ev.where], sim: flash.sim }); const c = centroids.get(ev.where); if (c) setFocus(c) }
    else if (/Doomsday/.test(flash.title)) setFocus([41.9, -87.6])
    const t = setTimeout(() => setFlare(null), 2600)
    return () => clearTimeout(t)
  }, [flash]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play: one simulated step (two quarters) per STEP_MS, the first step at once. Stops at 2029Q4.
  useEffect(() => {
    if (!playing) return
    const next = cur + 1
    if (next >= frames.length) { setPlaying(false); return }
    const nf = frames[next], st = nf.provenance === 'simulated' ? stepAt(future, nf.start) : null
    const n = st && !isSecondQuarter(st, nf.start) && next + 1 < frames.length ? next + 1 : next
    const t = setTimeout(() => go(n, true), cur === today ? FIRST_MS : st ? STEP_MS : 1500)
    return () => clearTimeout(t)
  }, [playing, cur, frames, future, today, go])

  const play = () => { if (cur >= frames.length - 1) go(today, false); setPlaying(true) }
  const choose = (i: number) => { setFi(i); setPop(null) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input,textarea')) return
      if (e.key === 'Escape') { if (feedOpen) return setFeedOpen(false); if (maxed) return setMaxed(null); setSheet(null); setPop(null); return }
      if (sheet) return
      const k = e.key.toLowerCase()
      if (k === 'e') setView(view === 'engine' ? 'world' : 'engine')
      else if (k === 'f' && view === 'engine') setMaxed(maxed ? null : 'graph')
      else if (e.key === '?') setTouring(true)
      else if (e.key === ' ' && !(e.target as HTMLElement).closest('button,[role=button],[role=slider]')) { e.preventDefault(); if (playing) setPlaying(false); else play() }
      else if (e.key === 'ArrowRight' && !(e.target as HTMLElement).closest('[role=slider]')) { setPlaying(false); go(cur + 1, true) }
      else if (e.key === 'ArrowLeft' && !(e.target as HTMLElement).closest('[role=slider]')) { setPlaying(false); go(cur - 1, false) }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  useEffect(() => { if (params.has('flash')) setFlashes(flashesFor(frame, cur)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const whereOf = (e: WorldEvent & { lat: number; lng: number }) => countryName(countries, e.where) ?? (e.where || e.region !== 'rest' ? countryAt(countries, e.lat, e.lng) ?? 'location not stated' : 'location not stated')
  const setting = bulletinAt(bulletin, Date.parse(world.asOf))
  const postOf = (e: WorldEvent) => step?.topPosts.find((p) => e.postIds?.includes(p.postId))?.text

  return (
    <div className={view} onClick={() => setPop(null)}>
      <Suspense fallback={<div id="globe" />}>
        <GlobeView hidden={view === 'engine'} countries={countries} dcs={data.dcs} frame={frame} closeness={closeness(hand)} ended={false} events={located} spanMs={live && playing ? STEP_MS : null} flare={flare} focus={focus} rotate={!sheet && view === 'world'} onPick={(e, anchor) => setPop({ e, anchor })} />
      </Suspense>
      <div id="vignette" />
      <Clock hand={hand} pin={scale.pin} daysPerSecond={scale.daysPerSecond} today={timeline.clock} isToday={isToday} frame={frame} prev={frames[cur - 1] ?? null}
        sim={step ? { n: fi + 1, of: futures.length, step, move: sheet ? null : move, live: live && !sheet && view !== 'engine', standIn: !!future.fixture } : null} onWhy={() => setSheet('why')} />
      <nav id="viewseg" className="dc-panel" aria-label="View">
        <div className="dc-tabs">
          <button aria-pressed={sheet === 'inputs'} onClick={() => setSheet('inputs')}>Inputs</button>
          <button aria-pressed={sheet !== 'inputs' && view === 'world'} onClick={() => { setSheet(null); setView('world') }}>World</button>
          <button aria-pressed={sheet !== 'inputs' && view === 'engine'} onClick={() => { setSheet(null); setView('engine') }}>Engine<kbd>E</kbd></button>
        </div>
      </nav>
      {view === 'engine' && <Suspense fallback={null}><EngineScreen futureId={futures[fi]?.id ?? 1} step={step?.step ?? 1} live={liveDemo} /></Suspense>}
      <FutureSwitcher futures={futures} current={fi} endDate={frames.at(-1)?.clock?.date10 ?? null} onPick={choose} />
      {view === 'world' && <Legend />}
      <NewsFeed events={feed.events} playing={playing} freshFrom={Date.parse(frame.start)} onExpand={() => setFeedOpen(true)} />
      {feedOpen && <FeedPage events={feed.events} posts={feed.posts} onClose={() => setFeedOpen(false)} />}
      <footer id="dock" className="dc-panel">
        <Ticker key={frame.quarter + fi} events={shown} real={frame.provenance === 'real'} onRead={() => setPlaying(false)} />
        <div className="dc-timebar">
          <button className="dc-play" aria-label={playing ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); if (playing) setPlaying(false); else play() }}>
            <svg viewBox="0 0 14 14">{playing ? <path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" /> : <path d="M3 1.5v11l9-5.5z" />}</svg>
          </button>
          <Spine frames={frames} cur={cur} today={today} future={timeline.future} onScrub={(i) => { setPlaying(false); go(i, false) }} />
          <button className="dc-btn dc-btn--quiet tour-again" onClick={(e) => { e.stopPropagation(); setTouring(true) }}>Show me around <kbd>?</kbd></button>
        </div>
      </footer>
      <Newsflash flash={flash} onDone={() => setFlashes((f) => f.slice(1))} />
      {pop && <EventPop e={pop.e} anchor={pop.anchor} where={whereOf(pop.e)} avatars={data.avatars} post={postOf(pop.e)} onClose={() => setPop(null)} />}
      {sheet === 'inputs' && <InputsSheet world={world} dcs={data.dcs} worldSource={data.worldSource} onClose={() => setSheet(null)} />}
      {sheet === 'why' && <WhySheet world={world} timeline={timeline} hand={scale.hand(frames[today], true)} pin={scale.pin} daysPerSecond={scale.daysPerSecond} backtest={backtest}
        future={future} step={step} luck={luck} tab={whyTab} onTab={setWhyTab} onClose={() => setSheet(null)} />}
      {touring && <Tour steps={tourSteps({ date10: timeline.clock.date10, daysPerSecond: scale.daysPerSecond, landed: cur > today,
        trackHeadline,
        openInputs: () => { setPlaying(false); setSheet('inputs') }, closeSheets: () => setSheet(null),
        openDanger: () => { setWhyTab('danger'); setSheet('why') }, openTrack: () => { setWhyTab('track'); setSheet('why') } })}
        onEnd={() => setTouring(false)} />}
      <span className="sr-only" aria-live="polite">{setting ? `The Bulletin stands at ${setting.seconds_to_midnight} seconds.` : ''}</span>
    </div>
  )
}
