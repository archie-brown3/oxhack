// Inputs: what the engine knows, as of a date. A Paper sheet with an as-of slider that hides
// everything dated on or after T, which shows there's no leakage. Reads the same World the engine
// reads (point-in-time: ts < T). Demo step 1; Run live closes it and starts the replay.
import { useMemo, useState } from 'react'
import type { NodeId, World, WorldEvent } from '../../contracts.ts'
import type { Datacentre } from '../../app/data.ts'
import { dmy, fmt, pct, sourceName } from '../format.ts'

const DAY = 864e5
const D0 = Date.UTC(2024, 9, 24)
const NODES: NodeId[] = ['asi2030', 'asi2040', 'asi2100', 'cat2100']
type Src = 'markets' | 'incident' | 'government' | 'news' | 'datacentres'
const SOURCES: [Src, string][] = [['markets', 'Markets'], ['incident', 'Incidents'], ['government', 'Government'], ['news', 'News'], ['datacentres', 'Datacentres']]

interface Props { world: World; dcs: Datacentre[]; worldSource: 'cache' | 'fixture'; onRun: () => void; onClose: () => void }

export function InputsSheet({ world, dcs, worldSource, onRun, onClose }: Props) {
  const asOf = Date.parse(world.asOf)
  const last = Math.floor((asOf - D0) / DAY)
  const [day, setDay] = useState(last)
  const [src, setSrc] = useState<Src>('markets')
  const T = Math.min(asOf, D0 + (day + 1) * DAY) // the end of the chosen day; read ts < T
  const known = useMemo(() => {
    const ev = (k: WorldEvent['kind']) => world.events.filter((e) => e.kind === k && e.provenance === 'real' && Date.parse(e.ts) < T).reverse()
    return {
      incident: ev('incident'), government: ev('government'), news: ev('news'),
      datacentres: dcs.filter((d) => Date.parse(d.ts) < T).sort((a, b) => b.ts.localeCompare(a.ts)),
      prices: Object.fromEntries(NODES.map((id) => [id, world.anchorHistory[id].history.filter((p) => Date.parse(p.ts ?? p.T) < T)])),
    }
  }, [world, dcs, T])
  const count = (k: Src) => (k === 'markets' ? NODES.length : known[k].length)
  const total = world.events.filter((e) => e.provenance === 'real').length + dcs.length + NODES.reduce((n, id) => n + world.anchorHistory[id].history.length, 0)
  const seen = known.incident.length + known.government.length + known.news.length + known.datacentres.length + NODES.reduce((n, id) => n + known.prices[id].length, 0)
  const rows = <T,>(list: T[], row: (x: T, i: number) => React.ReactNode) => list.length
    ? <>{list.slice(0, 40).map(row)}{list.length > 40 && <p className="dc-faint" style={{ margin: 0 }}>and {fmt(list.length - 40)} earlier items</p>}</>
    : <p className="dc-faint">Nothing yet at this date.</p>
  const ev = (e: WorldEvent, i: number) => (
    <div className="irow" key={i}><span className="dc-data">{dmy(e.ts)}</span>
      <div>{e.url ? <a href={e.url} target="_blank" rel="noopener">{e.title}</a> : e.title}
        <span className="src dc-data">{[e.who, sourceName(e.source)].filter(Boolean).join(' · ')}</span></div></div>
  )
  const head = (h: string, srcLine: string, note?: string) => <><div className="lede"><span className="dc-label dc-label--real">Real</span><span className="dc-data">{srcLine}</span></div><h3>{h}</h3>{note && <p>{note}</p>}</>
  return (
    <div className="scrim on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet dc-sheet" data-theme="paper" role="dialog" aria-modal="true" aria-labelledby="inputs-h" onKeyDown={(e) => e.key === 'Enter' && !(e.target as HTMLElement).closest('a,button,input') && onRun()}>
        <button className="x" aria-label="Close" onClick={onClose}>×</button>
        <h2 className="title" id="inputs-h">What the engine knows</h2>
        <div className="asof">
          <div className="asof-read"><span className="eyebrow">As of</span><b>{dmy(new Date(D0 + day * DAY).toISOString())}</b>
            <span className="dc-dim">{day >= last ? `Today. Data frozen ${dmy(world.asOf)}${worldSource === 'fixture' ? ' (engine fixture)' : ''}.` : `${fmt(total - seen)} later items hidden`}</span></div>
          <input type="range" id="asof" min={0} max={last} value={day} aria-label="As of date" onChange={(e) => setDay(+e.target.value)} style={{ ['--p' as string]: `${(day / last) * 100}%` }} />
          <div className="asof-ticks"><span>24 Oct 2024</span><span>2025</span><span>2026</span><span>Today</span></div>
        </div>
        <div className="split">
          <div className="lead">
            <div className="dc-tabs" id="intabs">{SOURCES.map(([k, t]) => <button key={k} aria-pressed={src === k} onClick={() => setSrc(k)}>{t}<span className="dc-data">{fmt(count(k))}</span></button>)}</div>
            <p className="dc-dim" style={{ margin: 0 }}>Every item is dated by when it became public. The engine reads only items dated before the as-of date, so nothing from the future leaks in.</p>
          </div>
          <article className="story">
            {src === 'markets' ? <>
              {head('Market anchors', 'Manifold · priced at each quarter', 'The four prices the Monte Carlo is built on, as each stood before the as-of date.')}
              <table className="tbl"><thead><tr><th>Question</th><th className="n">Price</th><th className="n">Quarterly readings</th><th className="n">Traders today</th></tr></thead>
                <tbody>{NODES.map((id) => { const h = world.anchorHistory[id], p = known.prices[id], l = p.at(-1)
                  return <tr key={id}><td><a href={h.url} target="_blank" rel="noopener">{h.question}</a>{l && <small>price on {dmy(l.ts ?? l.T)}</small>}</td>
                    <td className="n"><b>{l ? pct(l.p) : '–'}</b></td><td className="n">{p.length}</td><td className="n">{h.traders}</td></tr> })}</tbody></table>
            </> : src === 'datacentres' ? <>
              {head('Datacentres', 'Epoch AI', 'Publicly mapped sites, not compute share. The globe marks each one from its date.')}
              {rows(known.datacentres, (d, i) => <div className="irow" key={i}><span className="dc-data">{dmy(d.ts)}</span><div>{d.name}<span className="src dc-data">{d.operator} · {d.country}{d.power_mw ? ` · ${d.power_mw} MW` : ''}</span></div></div>)}
            </> : <>
              {head({ incident: 'AI incidents', government: 'Government actions', news: 'AI news' }[src], { incident: 'AI Incident Database', government: 'Federal Register, GOV.UK, EUR-Lex', news: 'Wikipedia timeline of AI' }[src])}
              {rows(known[src], ev)}
            </>}
          </article>
        </div>
        <div className="infoot"><p>Run live samples 10,000 futures in your browser, then replays the real record to today.</p>
          <button className="dc-btn dc-btn--primary" onClick={onRun}>Run live <kbd>⏎</kbd></button></div>
      </div>
    </div>
  )
}
