// The quarter face, ported from the design system's DoomClock.face() (context/design-system/
// components/bundle.js). Midnight at the top, the last 15 minutes run anticlockwise to nine
// o'clock, one minute is one year. Returns an SVG string styled by ds.css (.dc-face).
const CX = 96
const CY = 96
const R = 88
const n = (v: number) => Math.round(v * 100) / 100
const pt = (min: number, r: number): [number, number] => {
  const a = (min * Math.PI) / 30
  return [n(CX - r * Math.sin(a)), n(CY - r * Math.cos(a))]
}
const arc = (m0: number, m1: number, r: number) => `M${pt(m0, r)} A${r},${r} 0 0 0 ${pt(m1, r)}`
const line = (cls: string, a: number[], b: number[]) => `<line class="${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`

export interface FaceOptions {
  minutes: number
  /** The 1–10 year lag crossings, in minutes. */
  range?: [number, number]
  /** The Bulletin's seconds ÷ 60. */
  ghost?: number
  labels?: boolean
  label?: string
  /** Face-minute positions and their labels. Default: the design system's 5 y, 10 y, 15 y. */
  marks?: [number, string][]
  ghostLabel?: string
}

export function face(o: FaceOptions): string {
  const m = Math.min(15, Math.max(0, o.minutes))
  let s = `<svg class="dc-face" viewBox="0 0 100 100" role="img" aria-label="${o.label ?? `Clock at ${m.toFixed(1)} minutes to midnight`}">`
  s += `<path class="sector" d="M${CX},${CY} L${CX},${CY - R} A${R},${R} 0 0 0 ${pt(15, R)} Z"/>`
  if (o.range) s += `<path class="band" d="${arc(Math.min(15, o.range[0]), Math.min(15, o.range[1]), R - 5)}"/>`
  for (let k = 0; k <= 15; k++) {
    const major = k % 5 === 0
    s += line(major ? 'tick major' : 'tick', pt(k, R - (major ? 11 : 6)), pt(k, R - 1))
  }
  s += `<path class="rim" d="${arc(0, 15, R)}"/>`
  if (o.labels !== false)
    for (const [k, t] of o.marks ?? [[5, '5 y'], [10, '10 y'], [15, '15 y']]) {
      const p = pt(k, R - 20)
      s += `<text class="num" x="${p[0]}" y="${n(p[1] + 2)}" text-anchor="middle">${t}</text>`
    }
  if (o.ghost != null) {
    s += line('ghost', pt(o.ghost, R - 15), pt(o.ghost, R + 2))
    if (o.labels !== false) {
      const g = pt(o.ghost, R + 4)
      s += `<text class="num ghost-t" x="${n(g[0] - 2)}" y="${n(g[1] - 1)}" text-anchor="end">${o.ghostLabel ?? 'Bulletin 85 s'}</text>`
    }
  }
  const mid = pt(0, R)
  s += `<circle class="midnight" cx="${mid[0]}" cy="${mid[1]}" r="3"/>`
  // Tapered hand: wide at the hub, narrow at the tip.
  const tip = pt(m, R - 8)
  const dx = tip[0] - CX
  const dy = tip[1] - CY
  const len = Math.hypot(dx, dy)
  const px = -dy / len
  const py = dx / len
  const poly = [
    [CX + px * 2.6, CY + py * 2.6],
    [tip[0] + px * 0.6, tip[1] + py * 0.6],
    [tip[0] - px * 0.6, tip[1] - py * 0.6],
    [CX - px * 2.6, CY - py * 2.6],
  ]
  s += `<polygon class="hand" points="${poly.map((p) => p.map(n).join(',')).join(' ')}"/>`
  s += `<circle class="hub" cx="${CX}" cy="${CY}" r="4"/></svg>`
  return s
}
