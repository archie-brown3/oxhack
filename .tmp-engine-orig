// The Engine screen: the MiroFish society under the watched future. Everything here is
// SIMULATED. It reads a recorded run; until the runs library lands (task 11) that is the test
// spike fixture, labelled as such. Timed playback remains RECORDED; live backend is task 16.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { QuarterLabel, SampledFuture } from '../../contracts.ts'
import { fmt, monthYear, qName } from '../format.ts'
import spikeRaw from './spike.fixture.json?raw'

export interface CastMember { id: number; name: string; type: string; stance: string; influence: number; activity: number; handle: string; bio: string }
export interface Post { id: number; uid: number; round: number; text: string; quote: string | null; likes: number; shares: number }
export interface Seed { uid: number; kind: string; text: string }
export interface EngineRun {
  schema: 'doomclock.engine-run/0'; fixture: boolean; source: string; runId: string
  cast: CastMember[]; posts: Post[]; seeds: Seed[]
  runs: { turn: number; label: string; wall_s: number; cost: number; rounds: number[] }[]
  graph: { nodes: { id: string; name: string; label: string; summary: string }[]; edges: { s: string; t: string }[] }
}
export const RUN = JSON.parse(spikeRaw) as EngineRun
export interface Avatar { id: string; name: string; role: string; file: string; aliases: string[] }

const ROLE = (t: string) => ({ GovernmentAgency: 'gov', Policymaker: 'gov', MediaOutlet: 'media', Journalist: 'media', Ailab: 'lab' })[t] ?? 'other'
const ROLENAME: Record<string, string> = { gov: 'Government', media: 'Media', lab: 'AI lab', other: 'Other' }
const ORDER: Record<string, number> = { gov: 0, media: 1, lab: 2, other: 3 }
// Country is inferred from the account's name (mock) until the cast carries it.
const COUNTRY: [string, string][] = [['Australian', 'Australia'], ['Delhi', 'India'], ['Greek', 'Greece'], ['Canad', 'Canada'], ['Spanish', 'Spain'], ['Argentine', 'Argentina'],
  ['DeepSeek', 'China'], ['Alibaba', 'China'], ['DeepMind', 'United Kingdom'], ['New Jersey', 'United States'], ['Philadelphia', 'United States'], ['CNN', 'United States'],
  ['FBI', 'United States'], ['US government', 'United States'], ['D.C.', 'United States'], ['Meta', 'United States'], ['OpenAI', 'United States'], ['Anthropic', 'United States'],
  ['Claude', 'United States'], ['xAI', 'United States'], ['Bulletin', 'United States'], ['Mother Jones', 'United States'], ['Clara', 'United States'], ['Incident Database', 'United States']]
export const countryOf = (name: string) => COUNTRY.find(([k]) => name.includes(k))?.[1] ?? 'not stated'
const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function Av({ c, avatars }: { c: CastMember | undefined; avatars: Avatar[] }) {
  const a = c && avatars.find((x) => x.aliases.includes(c.handle) || x.name === c.name)
  return a ? <img className="av" src={`avatars/${a.file}`} alt="" /> : <div className="av" aria-hidden>{initials(c?.name ?? '?')}</div>
}

export interface Member { k: number; q: number; future: SampledFuture }
interface Props {
  future: SampledFuture
  ensemble: Member[]
  quarter: QuarterLabel
  /** The first simulated quarter: the live run streams into it. */
  firstSim: QuarterLabel
  live: { t0: number; shown: number } | null
  avatars: Avatar[]
  maxed: 'graph' | 'cast' | null
  onMax: (m: 'graph' | 'cast' | null) => void
  onWatch: (m: Member) => void
}

export function EngineScreen({ future, ensemble, quarter, firstSim, live, avatars, maxed, onMax, onWatch }: Props) {
  const castById = useMemo(() => new Map(RUN.cast.map((c) => [c.id, c])), [])
  const stream = useMemo(() => [...RUN.posts].sort((a, b) => a.round - b.round || a.id - b.id), [])
  const q = quarter <= firstSim ? firstSim : quarter
  const isLive = !!live && q === firstSim
  const posts = (isLive ? stream.slice(0, live!.shown) : stream).slice().reverse()
  const member = ensemble.reduce((b, m) => (Math.abs(m.q - future.percentile) < Math.abs(b.q - future.percentile) ? m : b), ensemble[0])
  const [hl, setHl] = useState<string | null>(null)
  const [graphZoom, setGraphZoom] = useState(1)
  const [, tick] = useState(0)
  // Keep keyboard focus in the expanded view, then return it to its opener.
  useEffect(() => {
    if (!maxed) return
    const opener = document.activeElement as HTMLElement | null
    const panel = document.querySelector<HTMLElement>(maxed === 'cast' ? '#roster' : '.maxpanel')!
    const close = panel.querySelector<HTMLButtonElement>('button')!
    close.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const buttons = [...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const first = buttons[0], last = buttons.at(-1)!
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    panel.addEventListener('keydown', trap)
    return () => { panel.removeEventListener('keydown', trap); opener?.focus() }
  }, [maxed])
  useEffect(() => { if (!isLive) return; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [isLive])
  const secs = isLive ? Math.round((Date.now() - live!.t0) / 1000) : 0
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const done = isLive && live!.shown >= stream.length
  const seeds = RUN.seeds.filter((s) => s.kind !== 'carry_over'), carry = RUN.seeds.filter((s) => s.kind === 'carry_over')
  const gn = posts.filter((p) => ['gov', 'media'].includes(ROLE(castById.get(p.uid)?.type ?? '')))
  const run = RUN.runs[(quarterIndex(q) - quarterIndex(firstSim)) % RUN.runs.length]
  const stats = isLive
    ? { rounds: posts[0]?.round ?? 0, acts: posts.length, unit: 'posts', secs, cost: ((secs / 47) * 0.03).toFixed(3), bars: [1, 2, 3].map((r) => stream.slice(0, live!.shown).filter((p) => p.round === r).length) }
    : { rounds: run.rounds.length - 1, acts: run.rounds.slice(1).reduce((a, b) => a + b, 0), unit: 'actions', secs: Math.round(run.wall_s), cost: run.cost.toFixed(3), bars: run.rounds }
  const mx = Math.max(1, ...stats.bars)
  const fixture = RUN.fixture ? ' (test fixture)' : ''

  const postEl = (p: Post | Seed, seed = '') => {
    const c = castById.get(p.uid), id = 'id' in p ? p.id : null
    return (
      <div className={`post${seed ? ' seed' : ''}${hl === c?.name ? ' hl' : ''}${isLive && id === posts[0]?.id && !done ? ' new' : ''}`} key={(id ?? 's') + p.text.slice(0, 20)}>
        <Av c={c} avatars={avatars} />
        <div style={{ minWidth: 0 }}>
          <div className="who"><b>{c?.name}</b><span>{ROLENAME[ROLE(c?.type ?? '')]} · {countryOf(c?.name ?? '')}</span><span>{seed ? `${seed} · ${qName(q)}` : `round ${'round' in p ? p.round : 0} · ${qName(q)}`}</span></div>
          <div className="tx">{'quote' in p && p.quote ? p.quote : p.text}</div>
          {'quote' in p && p.quote && <div className="qt">{p.text}</div>}
          <div className="meta dc-data"><span className="dc-label dc-label--sim">Simulated</span><span>MiroFish {RUN.runId}{fixture}</span>{'likes' in p && <span>♡ {p.likes} ↻ {p.shares}</span>}</div>
        </div>
      </div>
    )
  }
  return (
    <>
      <aside id="society" className="dc-panel" aria-label="Society">
        <h3 className="eyebrow">Society <span className="dc-data">nearest of {ensemble.length}</span></h3>
        <div className="members">
          {ensemble.map((m) => <button key={m.k} aria-pressed={m === member} onClick={() => onWatch(m)}>
            <span className="dc-data">#{m.k}</span><span>{Math.round(m.q * 100)}th pct · {m.future.catDate ? `ends ${monthYear(m.future.catDate)}` : 'no catastrophe'}</span></button>)}
        </div>
        <h3 className="eyebrow">Run stats <span className="dc-data">{qName(q)}{isLive ? ' · replay' : ''}</span></h3>
        <div className="run">
          <div className="nums"><div><b>{stats.rounds}</b>rounds</div><div><b>{stats.acts}</b>{stats.unit}</div><div><b>{stats.secs} s</b>{isLive ? 'replay time' : 'time'}</div><div><b>${run.cost.toFixed(3)}</b>recorded cost</div></div>
          <div className="rounds" title="Per round">{stats.bars.map((a, i) => <i key={i} style={{ height: `${(a / mx) * 100}%` }} />)}</div>
        </div>
        <div className="dc-faint">{isLive ? 'Playing recorded posts. No live backend is connected. ' : ''}{RUN.fixture ? 'Fixture: the test spike runs stand in for every quarter and future until the recorded runs land.' : ''}</div>
      </aside>
      <main id="engine">
        <div className="head">
          <span className="dc-label dc-label--sim">Simulated</span>
          <h2>The society under Future #{fmt(future.id)}, {qName(q)}{quarter < firstSim ? ' (the first simulated quarter)' : ''}</h2>
          <span className="dc-data">MiroFish · X only · English</span>
          {isLive
            ? <span className="state">Recorded replay <span className="dc-data">{done ? 'complete' : `round ${posts[0]?.round ?? 1} of 3`} · {mmss} · {posts.length}/{stream.length} posts{fixture}</span></span>
            : <span className="state">Recorded <span className="dc-data">run {RUN.runId}{fixture} · seed 1 · path {future.id}</span></span>}
        </div>
        <section className="pane dc-panel" id="p-x"><h3 className="eyebrow">X feed <span className="dc-data">{isLive ? `${posts.length} of ${stream.length}` : posts.length} posts</span></h3>
          <div className="scroll">{posts.map((p) => postEl(p))}{carry.map((p) => postEl(p, 'carried over from last quarter'))}</div></section>
        <section className="pane dc-panel" id="p-gn"><h3 className="eyebrow">Government &amp; news <span className="dc-data">{seeds.length} seeded · {gn.length} posts</span></h3>
          <div className="scroll">{seeds.map((p) => postEl(p, "this future's event, seeded"))}{gn.map((p) => postEl(p))}</div></section>
        <section className="pane dc-panel" id="p-cg">
          <h3 className="eyebrow">Cast &amp; graph <span className="dc-data">{RUN.cast.length} accounts</span></h3>
          <div id="kgwrap">
            {maxed !== 'graph' && <Graph hl={hl} onHover={setHl} big={false} zoom={graphZoom} onZoom={setGraphZoom} />}
            <button className="dc-btn dc-btn--sm maxbtn" onClick={() => onMax('graph')}>Full screen <kbd>F</kbd></button>
          </div>
          <div className="subhead"><span className="eyebrow">Cast</span><button className="dc-btn dc-btn--sm dc-btn--quiet" onClick={() => onMax('cast')}>Full roster</button></div>
          <div className="scroll">{[...RUN.cast].sort(byRole).map((c) => (
            <div className="ag" key={c.id + c.handle} onMouseEnter={() => setHl(c.name)} onMouseLeave={() => setHl(null)} title={c.bio}>
              <Av c={c} avatars={avatars} /><div style={{ minWidth: 0 }}><b>{c.name}</b>{ROLENAME[ROLE(c.type)]} · {c.stance}<span className="dc-label dc-label--sim">Simulated</span></div><span className="dc-data">{c.influence.toFixed(1)}</span></div>))}
          </div>
        </section>
      </main>
      {maxed === 'graph' && (
        <section className="maxpanel" role="dialog" aria-modal="true" aria-label="Knowledge graph">
          <div className="maxhead"><span className="dc-label dc-label--sim">Simulated</span><h2>Knowledge graph</h2><span className="dc-data">{RUN.graph.nodes.length} nodes · {RUN.graph.edges.length} edges · Zep graph from the smoke run</span>
            <button className="dc-btn dc-btn--sm" onClick={() => onMax(null)}>Close <kbd>Esc</kbd></button></div>
          <Graph hl={hl} onHover={setHl} big zoom={graphZoom} onZoom={setGraphZoom} />
        </section>
      )}
      {maxed === 'cast' && <Roster avatars={avatars} onClose={() => onMax(null)} />}
    </>
  )
}

const byRole = (a: CastMember, b: CastMember) => ORDER[ROLE(a.type)] - ORDER[ROLE(b.type)] || b.influence - a.influence
const quarterIndex = (q: QuarterLabel) => +q.slice(0, 4) * 4 + +q.slice(5)

function Roster({ avatars, onClose }: { avatars: Avatar[]; onClose: () => void }) {
  const posts = (id: number) => RUN.posts.filter((p) => p.uid === id).length
  return (
    <section id="roster" className="on" role="dialog" aria-modal="true" aria-label="Cast roster">
      <div className="rhead"><span className="dc-label dc-label--sim">Simulated</span><h2>The cast</h2><span className="dc-data">{RUN.cast.length} MiroFish accounts · X only{RUN.fixture ? ' · test fixture' : ''}</span>
        <button className="dc-btn dc-btn--sm" onClick={onClose}>Close <kbd>Esc</kbd></button></div>
      <table className="tbl"><thead><tr><th>Account</th><th>Role</th><th>Country</th><th>Stance</th><th className="n">Influence</th><th className="n">Activity</th><th className="n">Posts</th></tr></thead>
        <tbody>{[...RUN.cast].sort(byRole).map((c) => (
          <tr key={c.id + c.handle}><td><div className="acct"><Av c={c} avatars={avatars} /><div><b>{c.name}</b> <span className="dc-data">@{c.handle}</span><small>{c.bio}</small></div></div></td>
            <td>{ROLENAME[ROLE(c.type)]}<small>{c.type}</small></td><td>{countryOf(c.name)}</td><td>{c.stance}</td>
            <td className="n">{c.influence.toFixed(1)}</td><td className="n">{c.activity.toFixed(2)}</td><td className="n">{posts(c.id)}</td></tr>))}</tbody></table>
      <p className="dc-faint">Country is inferred from the account's name <span className="dc-mock">mock</span>. Roles, stances, influence and activity come from the MiroFish simulation config.</p>
    </section>
  )
}

// ---------- knowledge graph: a small force layout, computed once ----------
type KNode = { name: string; label: string; summary: string; x: number; y: number; vx: number; vy: number }
const KG = (() => {
  const nodes: KNode[] = RUN.graph.nodes.map((n, i) => ({ ...n, x: Math.cos(i * 2.4) * (30 + (i % 50)), y: Math.sin(i * 2.4) * (30 + (i % 50)), vx: 0, vy: 0 }))
  const idx = new Map(RUN.graph.nodes.map((n, i) => [n.id, i]))
  const edges = RUN.graph.edges.map((e) => [idx.get(e.s), idx.get(e.t)] as const).filter((e): e is readonly [number, number] => e[0] != null && e[1] != null)
  const deg = nodes.map(() => 0); edges.forEach(([a, b]) => { deg[a]++; deg[b]++ })
  for (let it = 0; it < 260; it++) {
    const cool = 1 - it / 260
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01
      if (d2 > 40000) continue
      const f = 140 / d2; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f
    }
    edges.forEach(([i, j]) => { const a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) + 0.01, f = (d - 26) * 0.02; a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f })
    nodes.forEach((n) => { n.vx -= n.x * 0.004; n.vy -= n.y * 0.004; n.x += n.vx * cool; n.y += n.vy * cool; n.vx *= 0.55; n.vy *= 0.55 })
  }
  return { nodes, edges, deg, cast: new Set(RUN.cast.map((c) => c.name)) }
})()
const KGROLE = (l: string) => ROLE(l)

const clampZoom = (z: number) => Math.max(0.5, Math.min(4, z))

function Graph({ hl, onHover, big, zoom, onZoom }: { hl: string | null; onHover: (n: string | null) => void; big: boolean; zoom: number; onZoom: (z: number | ((prev: number) => number)) => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const map = useRef<((n: KNode) => [number, number]) | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; n: KNode } | null>(null)
  const [size, setSize] = useState(0)
  const touches = useRef(new Map<number, [number, number]>())
  const pinchDistance = useRef<number | null>(null)
  const release = (id: number) => { touches.current.delete(id); pinchDistance.current = null }
  useEffect(() => {
    const el = cv.current!
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY) onZoom((z) => clampZoom(z * Math.exp(-Math.sign(e.deltaY) * 0.12)))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [onZoom])
  useEffect(() => { const r = () => setSize((s) => s + 1); addEventListener('resize', r); return () => removeEventListener('resize', r) }, [])
  useEffect(() => {
    const el = cv.current!, r = el.getBoundingClientRect()
    if (!r.width) return
    const css = getComputedStyle(el), v = (n: string) => css.getPropertyValue('--' + n).trim()
    const shade: Record<string, string> = { gov: v('ink'), media: v('ink-2'), lab: v('ink-3'), other: v('rule-strong') }
    const dpr = devicePixelRatio || 1; el.width = r.width * dpr; el.height = r.height * dpr
    const c = el.getContext('2d')!; c.scale(dpr, dpr)
    const { nodes, edges, deg, cast } = KG
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y), [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const pad = big ? 72 : 16, sc = zoom * Math.min((r.width - 2 * pad) / (x1 - x0), (r.height - 2 * pad - 22) / (y1 - y0))
    const ox = (r.width - (x1 - x0) * sc) / 2, oy = (r.height - (y1 - y0) * sc) / 2
    const P = (n: KNode): [number, number] => [ox + (n.x - x0) * sc, oy + (n.y - y0) * sc]
    map.current = P
    const hi = hl ? nodes.findIndex((n) => n.name === hl) : hover, on = hi != null && hi >= 0
    const nb = new Set<number>(); if (on) edges.forEach(([a, b]) => { if (a === hi) nb.add(b); if (b === hi) nb.add(a) })
    edges.forEach(([a, b]) => { const [ax, ay] = P(nodes[a]), [bx, by] = P(nodes[b]), lit = hi === a || hi === b
      c.strokeStyle = lit ? v('ink') : v('rule'); c.lineWidth = lit ? 1.2 : 0.7; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke() })
    nodes.forEach((n, i) => { const [x, y] = P(n), isCast = cast.has(n.name), rad = (isCast ? 4 : 2) + Math.min(3.5, deg[i] * 0.3)
      c.globalAlpha = on && i !== hi && !nb.has(i) ? 0.2 : 1
      c.fillStyle = n.label === 'Entity' ? v('rule') : shade[KGROLE(n.label)]; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill()
      if (isCast) { c.strokeStyle = v('sim'); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, rad + 2.5, 0, 7); c.stroke() }
      if (i === hi || (on && nb.has(i) && isCast) || (big && isCast && !on)) { c.fillStyle = v('ink'); c.font = '12px -apple-system,system-ui'; c.fillText(n.name.slice(0, 30), x + rad + 5, y + 4) }
      c.globalAlpha = 1 })
  }, [hl, hover, big, size, zoom])
  return (
    <>
      <div className="kgzoom" role="group" aria-label="Knowledge graph zoom">
        <button className="dc-btn dc-btn--sm" aria-label="Zoom graph out" disabled={zoom <= 0.5} onClick={() => onZoom((z) => clampZoom(z / 1.25))}>−</button>
        <button className="dc-btn dc-btn--sm" aria-label="Zoom graph in" disabled={zoom >= 4} onClick={() => onZoom((z) => clampZoom(z * 1.25))}>+</button>
        <button className="dc-btn dc-btn--sm" aria-label="Reset graph zoom" onClick={() => onZoom(1)}>Reset</button>
        <output className="dc-data" aria-live="polite">{Math.round(zoom * 100)}%</output>
      </div>
      <canvas id="kg" role="img" aria-label={`Simulated knowledge graph: ${RUN.graph.nodes.length} nodes and ${RUN.graph.edges.length} connections. Account details are available in the full roster.`} ref={cv}
        onPointerDown={(e) => { if (e.pointerType !== 'touch') return; e.currentTarget.setPointerCapture(e.pointerId); touches.current.set(e.pointerId, [e.clientX, e.clientY]) }}
        onPointerMove={(e) => {
          if (!touches.current.has(e.pointerId)) return
          touches.current.set(e.pointerId, [e.clientX, e.clientY])
          const [a, b] = [...touches.current.values()]
          if (!a || !b) return
          const distance = Math.hypot(a[0] - b[0], a[1] - b[1]), previous = pinchDistance.current
          if (previous && distance) onZoom((z) => clampZoom(z * distance / previous))
          pinchDistance.current = distance
        }}
        onPointerUp={(e) => release(e.pointerId)} onPointerCancel={(e) => release(e.pointerId)}
        onMouseLeave={() => { setHover(null); setTip(null); onHover(null) }}
        onMouseMove={(e) => {
          if (!map.current) return
          const r = e.currentTarget.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
          let best: number | null = null, bd = 120
          KG.nodes.forEach((n, i) => { const [x, y] = map.current!(n), d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = i } })
          setHover(best); setTip(best == null ? null : { x: e.clientX, y: e.clientY, n: KG.nodes[best] })
        }} />
      <div id="kglegend">{['gov', 'media', 'lab', 'other'].map((r) => <span key={r}><i className={`k-${r}`} />{ROLENAME[r]}</span>)}<span><i className="k-cast" />MiroFish account</span></div>
      {tip && <div id="tooltip" className="dc-panel" style={{ display: 'block', left: Math.min(innerWidth - 320, tip.x + 14), top: tip.y + 12 }}><b>{tip.n.name}</b> <span className="dc-faint">{tip.n.label}</span><br /><span className="dc-dim">{tip.n.summary.slice(0, 220)}</span></div>}
    </>
  )
}
