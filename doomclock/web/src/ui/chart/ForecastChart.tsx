// The forecast chart: the real forecast (engine A, solid ink, REAL) as the chance of AI
// catastrophe by each date, with the 1-in-10 line the clock reads. Inline SVG, no dependencies.
// Works on Stage and Paper.
import type { IsoTime, Timeline } from '../../contracts.ts'
import { monthYear } from '../format.ts'
import { Label } from '../Label.tsx'

/** P(catastrophe by t). */
export interface LinePoint { t: IsoTime; p: number }

/** The real forecast as a line: 0 at the as-of date, then each projected quarter's share gone wrong. */
export function forecastLine(timeline: Timeline): LinePoint[] {
  const q = timeline.frames.filter((f) => f.provenance === 'projected')
  return [{ t: timeline.asOf, p: 0 }, ...q.map((f) => ({ t: new Date(Date.parse(f.start) + 91 * 864e5).toISOString(), p: f.pCat }))]
}

/** The first date a line reaches `p` (linear between points), or null. */
export function crossing(line: LinePoint[], p: number): number | null {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i]
    if (a.p < p && b.p >= p) { const ta = Date.parse(a.t), tb = Date.parse(b.t); return ta + ((p - a.p) / (b.p - a.p)) * (tb - ta) }
  }
  return line[0] && line[0].p >= p ? Date.parse(line[0].t) : null
}

interface Props {
  real: LinePoint[]
  /** The chance the date is read at (default 1 in 10). */
  threshold?: number
  /** Drawing width in viewBox units; the SVG scales to its container. */
  width?: number
  height?: number
  /** Show at most this many years from the first point. */
  years?: number
}

export function ForecastChart({ real, threshold = 0.1, width = 360, height = 150, years = 12 }: Props) {
  const L = 34, R = 8, T = 10, B = 22
  const x0 = Date.parse(real[0]?.t ?? new Date().toISOString())
  const x1 = Math.min(Date.parse(real.at(-1)?.t ?? '2100-01-01'), x0 + years * 365.25 * 864e5)
  const r = real.filter((d) => Date.parse(d.t) <= x1)
  const maxP = Math.max(threshold * 1.6, ...r.map((d) => d.p))
  const top = Math.ceil(maxP * 20) / 20
  const sx = (t: number) => L + ((t - x0) / (x1 - x0 || 1)) * (width - L - R)
  const sy = (p: number) => T + (1 - p / top) * (height - T - B)
  const path = (l: LinePoint[]) => l.map((d, i) => `${i ? 'L' : 'M'}${sx(Date.parse(d.t)).toFixed(1)},${sy(d.p).toFixed(1)}`).join('')
  const cr = crossing(r, threshold)
  const txt = { fill: 'var(--ink-3)', font: '400 12px var(--font-sans)' }
  const ticks: number[] = []
  const y0 = new Date(x0).getUTCFullYear() + 1, step = years > 8 ? 2 : 1
  for (let yr = y0; Date.UTC(yr, 0, 1) <= x1; yr += step) ticks.push(yr)
  return (
    <figure className="forecast-chart" style={{ margin: 0 }}>
      <figcaption className="chart-key">
        <span><svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" style={{ stroke: 'var(--ink)', strokeWidth: 2 }} /></svg> <Label kind="real">Real forecast</Label></span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img"
        aria-label={`Chance of AI catastrophe by date. The real forecast reaches 1 in 10 ${cr ? monthYear(new Date(cr).toISOString()) : 'after the chart'}.`}>
        {[0, threshold, top].map((p) => <g key={p}>
          <line x1={L} x2={width - R} y1={sy(p)} y2={sy(p)} style={{ stroke: p === threshold ? 'var(--ink-3)' : 'var(--rule)' }} strokeDasharray={p === threshold ? '3 3' : undefined} />
          <text x={L - 6} y={sy(p) + 4} textAnchor="end" style={txt}>{Math.round(p * 100)}%</text></g>)}
        {ticks.map((yr) => <text key={yr} x={sx(Date.UTC(yr, 0, 1))} y={height - 6} textAnchor="middle" style={txt}>{yr}</text>)}
        <path d={path(r)} style={{ stroke: 'var(--ink)', strokeWidth: 2, fill: 'none' }} />
        {cr != null && cr <= x1 && <circle cx={sx(cr)} cy={sy(threshold)} r={3.5} style={{ fill: 'var(--ink)' }} />}
      </svg>
    </figure>
  )
}
