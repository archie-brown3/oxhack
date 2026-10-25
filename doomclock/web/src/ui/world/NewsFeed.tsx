// The live news feed (World, right side) and its full page: events up to the scrubber, newest
// first. Real before today, simulated after, each with its label. Severity sets legibility:
// major is bold and at most 3 stay on top, moderate shows its full title, minor collapses to
// "+N minor". Reusable: it reads events and posts only, nothing from the engine.
import { useEffect, useRef, useState } from 'react'
import type { WorldEvent } from '../../contracts.ts'
import { dmy, sourceName } from '../format.ts'
import { Label, labelOf } from '../Label.tsx'
import { bySeverity, MAX_MAJOR_TITLES, severityOf } from './severity.ts'

export interface FeedPost { postId: number; actorId: number; text: string; step: number }
const MODERATE_CAP = 40

function Item({ e, fresh }: { e: WorldEvent; fresh?: boolean }) {
  const major = severityOf(e) === 'major'
  return (
    <div className={`fi${major ? ' major' : ''}${fresh ? ' new' : ''}`}>
      <div className="fm"><Label kind={labelOf(e.provenance)} /><time dateTime={e.ts}>{dmy(e.ts)}</time></div>
      <div className="ft">{e.url ? <a href={e.url} target="_blank" rel="noopener">{e.title}</a> : e.title}</div>
      <div className="fw dc-faint">{[e.who, sourceName(e.source)].filter(Boolean).join(' · ')}</div>
    </div>
  )
}

/** `events` newest first by ts. `fresh` marks those that landed with the current frame. */
export function NewsFeed({ events, playing, freshFrom, onExpand }: { events: WorldEvent[]; playing: boolean; freshFrom: number; onExpand: () => void }) {
  const [minorOpen, setMinorOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const sorted = [...events].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
  const majors = sorted.filter((e) => severityOf(e) === 'major').slice(0, MAX_MAJOR_TITLES)
  const moderate = sorted.filter((e) => severityOf(e) === 'moderate' && !majors.includes(e))
  const minor = sorted.filter((e) => severityOf(e) === 'minor')
  const hidden = sorted.filter((e) => severityOf(e) === 'major').length - majors.length
  // Newest is at the top: keep the top in view while it plays.
  useEffect(() => { if (playing) box.current?.scrollTo({ top: 0, behavior: 'smooth' }) }, [playing, events.length])
  const fresh = (e: WorldEvent) => Date.parse(e.ts) >= freshFrom
  return (
    <aside id="feed" className="dc-panel" aria-label="Live news feed">
      <div className="fh"><b>News{playing && <span className="live" aria-hidden="true" />}</b><span className="dc-data">{events.length} so far</span>
        <button className="dc-btn dc-btn--sm" onClick={onExpand}>Expand</button></div>
      <div className="fscroll" ref={box} aria-live="off">
        {majors.map((e) => <Item key={e.ts + e.title} e={e} fresh={playing && fresh(e)} />)}
        {hidden > 0 && <p className="dc-faint fmore">+{hidden} older major</p>}
        {moderate.slice(0, MODERATE_CAP).map((e) => <Item key={e.ts + e.title} e={e} fresh={playing && fresh(e)} />)}
        {moderate.length > MODERATE_CAP && <p className="dc-faint fmore">and {moderate.length - MODERATE_CAP} earlier items. Expand to read them.</p>}
        {minor.length > 0 && <button className="dc-btn dc-btn--sm dc-btn--quiet" onClick={() => setMinorOpen(!minorOpen)}>{minorOpen ? 'Hide' : `+${minor.length}`} minor</button>}
        {minorOpen && minor.slice(0, MODERATE_CAP).map((e) => <Item key={e.ts + e.title} e={e} />)}
        {!events.length && <p className="dc-faint">Nothing yet.</p>}
      </div>
    </aside>
  )
}

interface Account { id: number; name: string; username: string }
/** The full page: the X feed (simulated posts) beside government and news. */
export function FeedPage({ events, posts, onClose }: { events: WorldEvent[]; posts: FeedPost[]; onClose: () => void }) {
  const [cast, setCast] = useState<Map<number, Account>>(new Map())
  useEffect(() => { import('../../game/data/cast.json').then((m) => setCast(new Map((m.default.accounts as Account[]).map((a) => [a.id, a])))) }, [])
  const sorted = [...events].sort(bySeverity)
  const news = sorted.filter((e) => e.kind !== 'post')
  return (
    <section id="feedpage" role="dialog" aria-modal="true" aria-label="News feed">
      <div className="rhead"><h2>News feed</h2><span className="dc-data">everything up to the date on the time spine</span><button className="dc-btn dc-btn--sm" onClick={onClose}>Close <kbd>Esc</kbd></button></div>
      <div className="fcols">
        <div className="fcol dc-panel"><h3 className="eyebrow">X feed <span className="dc-data">{posts.length} posts</span></h3>
          <div className="fscroll">{posts.length ? [...posts].reverse().map((p) => { const a = cast.get(p.actorId)
            return <div className="fi" key={p.postId}><div className="fm"><Label kind="simulated" /><span className="dc-data">step {p.step}</span></div>
              <div className="fw"><b>{a?.name ?? `Account ${p.actorId}`}</b> {a && <span className="dc-faint">@{a.username}</span>}</div><div className="ft">{p.text}</div></div> })
            : <p className="dc-faint">X posts exist only inside the simulated futures. Press play to see the first step's posts.</p>}</div></div>
        <div className="fcol dc-panel"><h3 className="eyebrow">Government &amp; news <span className="dc-data">{news.length} items</span></h3>
          <div className="fscroll">{news.slice(0, 200).map((e) => <Item key={e.ts + e.title} e={e} />)}</div></div>
      </div>
    </section>
  )
}
