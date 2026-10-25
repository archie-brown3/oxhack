// How the markets set the clock, as one chart: the four Manifold prices as dots, the
// superintelligence curve through them (faint), the catastrophe curve the lag rule makes of it
// (solid), the 1-in-10 line, and the crossing, which is the date on the clock. Inline SVG over
// the engine's own curve (engine/curve.ts), so it can never disagree with the clock.
import { useEffect, useRef, useState } from 'react'
import type { IsoTime, NodeId, Prob } from '../../contracts.ts'
import { HORIZON, marketCurve, yearToIso } from '../../engine/index.ts'
import { longDate, monthYear, pct } from '../format.ts'
import { Label } from '../Label.tsx'

interface Props {
  anchors: Record<NodeId, Prob>
  /** Decimal year the reading is made: today, or the as-of date. */
  at: number
  lagMeanYears: number
  /** The clock's own date when the caller has it; otherwise the crossing's. */
  date10?: IsoTime | null
}

const BREAK = 2042 // linear to here; 2042..2100 is compressed after an axis break
const SPLIT = 0.74 // share of the plot width before the break
const GAP = 10
const H = 220, L = 38, R = 14, T = 30, B = 24

export function MarketCurve({ anchors, at, lagMeanYears, date10 }: Props) {
  const ref = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [w, setW] = useState(600)
  const [hover, setHover] = useState<number | null>(null) // decimal year under the pointer
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const c = marketCurve(anchors, at, lagMeanYears)
  const narrow = w < 420
  const xb = L + (w - L - R) * SPLIT
  const sxL = (y: number) => L + ((y - at) / (BREAK - at)) * (xb - L)
  const sxR = (y: number) => xb + GAP + ((y - BREAK) / (HORIZON - BREAK)) * (w - R - xb - GAP)
  const sx = (y: number) => (y <= BREAK ? sxL(y) : sxR(y))
  const sy = (p: number) => T + (1 - p) * (H - T - B)
  const path = (pts: { year: number; p: number }[], side: 'l' | 'r') =>
    pts.filter((d) => (side === 'l' ? d.year <= BREAK : d.year >= BREAK)).map((d, i) => `${i ? 'L' : 'M'}${(side === 'l' ? sxL : sxR)(d.year).toFixed(1)},${sy(d.p).toFixed(1)}`).join('')
  const anchor = (x: number) => (x > w - 60 ? 'end' : x < L + 30 ? 'start' : 'middle')
  const y10 = c.y10
  const dateText = date10 ?? (y10 === null ? null : yearToIso(y10))
  const y10x = y10 === null ? null : sx(y10)
  const line10 = sy(0.1)
  const [lo, hi] = c.y10Lag
  const ticks = (narrow ? [2030, 2040, 2100] : [2030, 2035, 2040, 2070, 2100]).filter((y) => y > at + 1.5)
  const txt = { fill: 'var(--ink-3)', font: '400 12px var(--font-sans)' } as const
  const ring = { stroke: 'var(--ground)', strokeWidth: 2 } as const
  const sides = ['l', 'r'] as const
  // Pointer x (in viewBox units, the SVG may be scaled down) back to a year, then the nearest sample.
  const yearAt = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    const x = (clientX - r.left) * (w / r.width)
    const y = x <= xb ? at + ((x - L) / (xb - L)) * (BREAK - at) : x >= xb + GAP ? BREAK + ((x - xb - GAP) / (w - R - xb - GAP)) * (HORIZON - BREAK) : BREAK
    return Math.min(HORIZON, Math.max(at, y))
  }
  const near = hover === null ? null : c.cat.reduce((b, d, i) => (Math.abs(d.year - hover) < Math.abs(c.cat[b].year - hover) ? i : b), 0)
  return (
    <figure ref={ref} className="mcurve" style={{ margin: 0, minWidth: 0 }}>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${H}`} width={w} height={H} style={{ display: 'block', maxWidth: '100%', height: 'auto', touchAction: 'pan-y' }} role="img"
        onPointerMove={(e) => setHover(yearAt(e.clientX))} onPointerLeave={() => setHover(null)}
        aria-label={`Four market prices, the curves built from them, and the date the chance of AI catastrophe passes 1 in 10${dateText ? `: ${longDate(dateText)}` : ''}`}>
        {[0, 0.5, 1].map((p) => <g key={p}><line x1={L} x2={w - R} y1={sy(p)} y2={sy(p)} style={{ stroke: 'var(--rule)' }} /><text x={L - 6} y={sy(p) + 4} textAnchor="end" style={txt}>{p * 100}%</text></g>)}
        {!narrow && <text x={L} y={H - 6} style={txt}>Today</text>}
        {ticks.map((y) => <text key={y} x={sx(y)} y={H - 6} textAnchor="middle" style={txt}>{y}</text>)}
        <g style={{ stroke: 'var(--ink-3)' }}><line x1={xb + 1} x2={xb + 5} y1={sy(0) + 5} y2={sy(0) - 5} /><line x1={xb + GAP - 5} x2={xb + GAP - 1} y1={sy(0) + 5} y2={sy(0) - 5} /></g>
        {lo !== null && hi !== null && <rect x={sx(lo)} y={line10 - 4} width={Math.max(2, sx(hi) - sx(lo))} height={8} style={{ fill: 'var(--ink-3)', opacity: 0.28 }}><title>{`1 to 10 year gap: ${longDate(yearToIso(lo))} to ${longDate(yearToIso(hi))}`}</title></rect>}
        <line x1={L} x2={w - R} y1={line10} y2={line10} style={{ stroke: 'var(--ink-2)' }} strokeDasharray="4 3" />
        <text x={w - R} y={line10 - 6} textAnchor="end" style={{ ...txt, fill: 'var(--ink-2)', fontWeight: 600 }}>1 in 10</text>
        {sides.map((s) => <path key={s} d={path(c.asi, s)} style={{ stroke: 'var(--ink-3)', strokeWidth: 1.5, fill: 'none', opacity: 0.7 }} />)}
        {sides.map((s) => <path key={s} d={path(c.cat, s)} style={{ stroke: 'var(--ink)', strokeWidth: 2, fill: 'none' }} strokeLinejoin="round" strokeLinecap="round" />)}
        {near !== null && <g style={{ pointerEvents: 'none' }}>
          <line x1={sx(c.cat[near].year)} x2={sx(c.cat[near].year)} y1={T} y2={sy(0)} style={{ stroke: 'var(--ink-3)' }} />
          <circle cx={sx(c.asi[near].year)} cy={sy(c.asi[near].p)} r={4} style={{ fill: 'var(--ink-3)', ...ring }} />
          <circle cx={sx(c.cat[near].year)} cy={sy(c.cat[near].p)} r={4} style={{ fill: 'var(--ink)', ...ring }} />
        </g>}
        {y10x !== null && dateText && <g>
          <line x1={y10x} x2={y10x} y1={T - 4} y2={line10} style={{ stroke: 'var(--alarm)' }} />
          <circle cx={y10x} cy={line10} r={5} style={{ fill: 'var(--alarm)', ...ring }}><title>{`1 in 10 on ${longDate(dateText)}`}</title></circle>
          <text x={y10x} y={T - 10} textAnchor={anchor(y10x)} style={{ fill: 'var(--ink)', font: '700 14px var(--font-sans)' }}>{longDate(dateText)}</text>
        </g>}
        {c.points.map((p) => { const x = sx(p.year), y = sy(p.p), asi = p.curve === 'asi', v = `${Math.round(p.p * 100)}%`
          return <g key={p.id}><title>{`${asi ? 'Superintelligence' : 'AI catastrophe'} by ${p.year}: ${v} (Manifold)`}</title>
            <circle cx={x} cy={y} r={4.5} style={{ fill: asi ? 'var(--ink-3)' : 'var(--ink)', ...ring }} />
            <text x={x} y={y - 9} textAnchor={anchor(x)} style={{ ...txt, fill: asi ? 'var(--ink-2)' : 'var(--ink)', fontWeight: 600 }}>{v}</text></g> })}
      </svg>
      <div className="dc-data" style={{ minHeight: 16, margin: 'var(--space-1) 0 0 38px' }} aria-live="polite">
        {near !== null ? `${monthYear(yearToIso(c.cat[near].year))} · catastrophe ${pct(c.cat[near].p)} · superintelligence ${pct(c.asi[near].p)}` : ''}
      </div>
      <figcaption className="dc-faint" style={{ display: 'flex', gap: 'var(--space-2) var(--space-4)', flexWrap: 'wrap', font: 'var(--type-body)', alignItems: 'center' }}>
        <span><Key dot /> Market price <Label kind="real" /></span>
        <span><Key c="var(--ink)" w={2} /> AI catastrophe</span>
        <span><Key c="var(--ink-3)" w={1.5} /> Superintelligence</span>
        <span><Key band /> {lagMeanYears} y gap, 1 to 10 y <Label kind="game-rule" /></span>
      </figcaption>
    </figure>
  )
}

function Key({ c, w, band, dot }: { c?: string; w?: number; band?: boolean; dot?: boolean }) {
  return <svg width="22" height="10" style={{ verticalAlign: 'middle' }} aria-hidden="true">
    {band ? <rect x="0" y="1" width="22" height="8" style={{ fill: 'var(--ink-3)', opacity: 0.28 }} />
      : dot ? <circle cx="11" cy="5" r="4" style={{ fill: 'var(--ink)' }} />
        : <line x1="0" x2="22" y1="5" y2="5" style={{ stroke: c, strokeWidth: w }} />}
  </svg>
}
