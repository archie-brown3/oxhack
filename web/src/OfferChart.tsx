import { gbp, type Plan } from './policy'

const W = 320
const H = 120
const PAD = { l: 28, r: 8, t: 16, b: 22 }

/** P(accept) across candidate offers, with the chosen offer and the buyer's ceiling marked. */
export function OfferChart({ plan, ceiling }: { plan: Plan; ceiling: number }) {
  const pts = plan.curve
  if (pts.length < 2) {
    return <p className="py-8 text-sm text-zinc-500 dark:text-zinc-400">No room left under the ceiling.</p>
  }
  const xMin = pts[0].offer
  const xMax = Math.max(pts[pts.length - 1].offer, ceiling)
  const x = (o: number) => PAD.l + ((o - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r)
  const yMax = Math.min(1, Math.max(0.5, Math.ceil(Math.max(...pts.map((d) => d.p)) * 10) / 10))
  const y = (p: number) => PAD.t + (1 - p / yMax) * (H - PAD.t - PAD.b)
  const line = pts.map((d, i) => `${i ? 'L' : 'M'}${x(d.offer).toFixed(1)},${y(d.p).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Chance the seller accepts at each offer price">
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="stroke-zinc-200 dark:stroke-zinc-800" />
      <line
        x1={x(ceiling)}
        x2={x(ceiling)}
        y1={PAD.t}
        y2={H - PAD.b}
        strokeDasharray="3 3"
        className="stroke-zinc-400 dark:stroke-zinc-600"
      />
      <path d={line} fill="none" strokeWidth={1.75} className="stroke-zinc-800 dark:stroke-zinc-200" />
      <circle cx={x(plan.offer)} cy={y(plan.p)} r={4.5} className="fill-emerald-600 dark:fill-emerald-400" />
      <text x={PAD.l} y={H - 6} className="fill-zinc-500 font-mono text-[9px]">
        {gbp(xMin)}
      </text>
      <text x={x(ceiling) - 4} y={10} textAnchor="end" className="fill-zinc-500 font-mono text-[9px]">
        your ceiling
      </text>
      <text x={0} y={PAD.t + 3} className="fill-zinc-500 font-mono text-[9px]">
        {Math.round(yMax * 100)}%
      </text>
      <text x={0} y={H - PAD.b + 3} className="fill-zinc-500 font-mono text-[9px]">
        0%
      </text>
      <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-zinc-500 font-mono text-[9px]">
        {gbp(xMax)}
      </text>
    </svg>
  )
}
