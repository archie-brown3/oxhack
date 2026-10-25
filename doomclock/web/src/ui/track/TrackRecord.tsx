// Track record: how market prices scored on resolved AI questions, out of sample, against a blind
// AI model, the base rate and a 50% coin; whether the model should nudge the market (w); the
// reliability curve; the leakage checks; and the society test (T7). A tab in the Why this time? sheet.
// Reads public/cache/backtest.json and t7.json (loadTrack); the `bt` prop is only a fallback.
import { useEffect, useState } from 'react'
import type { BacktestFile, ReliabilityBin, Score, T7File } from '../../contracts.ts'
import { loadTrack } from '../../app/data.ts'
import { dmy, fmt } from '../format.ts'
import './track.css'

const f3 = (x: number) => x.toFixed(3)
const ci = (s: Score) => `${f3(s.ci95[0])} to ${f3(s.ci95[1])}`
/** Mean distance from the diagonal, weighted by questions, in percentage points. */
const gap = (bins: ReliabilityBin[]) => {
  const n = bins.reduce((a, b) => a + b.n, 0)
  return n ? Math.round((bins.reduce((a, b) => a + b.n * Math.abs(b.meanForecast - b.observed), 0) / n) * 100) : 0
}

export function TrackRecord({ bt: fallback, fixture }: { bt: BacktestFile; fixture: boolean }) {
  const [loaded, setLoaded] = useState<{ bt: BacktestFile | null; t7: T7File | null } | null>(null)
  useEffect(() => { let on = true; loadTrack().then((x) => on && setLoaded(x)); return () => { on = false } }, [])
  const bt = loaded?.bt ?? (fixture ? null : fallback)
  if (!bt) return loaded ? <NotRun /> : <p className="dc-dim">Loading the track record…</p>
  return <Record bt={bt} t7={loaded?.t7 ?? null} />
}

function NotRun() {
  return <>
    <div className="lede"><span className="dc-data">Backtest not yet run</span></div>
    <h3>Track record is not available yet</h3>
    <p>We have not measured how well the inputs predict. Sample scores are hidden so they cannot be mistaken for results.</p>
    <p className="verdict">A prediction, not a prophecy.</p>
  </>
}

function Record({ bt, t7 }: { bt: BacktestFile; t7: T7File | null }) {
  const s = bt.scores.test
  const diff = (a: string, b: string) => bt.pairedDiffs.find((d) => d.a === a && d.b === b)
  const vsCoin = diff('market', 'coin'), vsBase = diff('market', 'baseRate'), llm = diff('blindLlm', 'market')
  const beats = (d?: { ci95: [number, number] }) => !!d && d.ci95[1] < 0
  const title = beats(vsCoin) && beats(vsBase)
    ? `${bt.design.horizonDays} days out, market prices beat a coin and the base rate`
    : beats(vsCoin) ? `${bt.design.horizonDays} days out, market prices beat a coin` : `${bt.design.horizonDays} days out, market prices did not clearly beat a coin`
  const rows: [string, string, Score | null][] = [
    ['Market price', 'The price 30 days before the question resolved.', s.market],
    ['Blind AI model', 'Gemini 2.5 Flash, shown only the question and the date.', s.blindLlm],
    ['Base rate', 'How often earlier questions from the same site resolved yes.', s.baseRate],
    ['50% coin', 'Always says even odds.', s.coin],
  ]
  const sites = Object.entries(bt.scores.bySource).filter(([, v]) => v.n).sort((a, b) => a[1].market.brier - b[1].market.brier)
  const siteName: Record<string, string> = { manifold: 'Manifold', polymarket: 'Polymarket', kalshi: 'Kalshi' }
  const checksOk = bt.leakage.checks.filter((c) => c.passed).length
  return (
    <div className="track">
      <div className="lede">
        <span className="dc-label dc-label--real">Real</span>
        <span className="dc-data">{bt.label === 'pilot' ? 'pilot sample · ' : ''}{fmt(bt.n.test)} questions scored · {dmy(bt.generatedAt)}</span>
      </div>
      <h3>{title}</h3>
      <p>We took {fmt(bt.n.pool)} AI questions from Kalshi, Polymarket and Manifold that have since resolved yes or no. For each, we read the market price 30 days before the answer was known. The later {fmt(bt.n.test)} questions are the test, scored by Brier: the average squared miss, where lower is better.</p>

      <table className="tbl tr-tbl">
        <thead><tr><th>Forecaster</th><th className="n">Brier</th><th className="tr-strip-h" aria-label="Brier with its 95% range, 0 to 0.30">0<span>0.30</span></th></tr></thead>
        <tbody>{rows.map(([name, note, x]) => x && (
          <tr key={name}>
            <td>{name}<small>{note}</small></td>
            <td className="n">{f3(x.brier)}<small>{ci(x)}</small></td>
            <td className="tr-strip"><Strip s={x} /></td>
          </tr>
        ))}</tbody>
      </table>
      <div className="tr-small">Manifold questions in this score have at least {bt.design.minTradersManifold} traders.</div>
      <div className="tr-small">The range is a 95% interval from resampling whole events, so ladders of related questions count once. By site, the market scored {sites.map(([k, v], i) => <span key={k}>{i ? (i === sites.length - 1 ? ' and ' : ', ') : ''}{f3(v.market.brier)} on {siteName[k] ?? k} ({fmt(v.n)})</span>)}.</div>

      <h4>Should an AI nudge the market?</h4>
      <p>{bt.w.text}{llm && ` On its own, the blind model scored ${f3(s.blindLlm.brier)}, worse than the market by ${llm.delta.toFixed(3)} (95% interval ${llm.ci95[0].toFixed(3)} to ${llm.ci95[1].toFixed(3)}).`}</p>

      <h4>When the market said 30%, did it happen 30% of the time?</h4>
      <Reliability market={bt.reliability} model={bt.reliabilityLlm} />
      <p>On average the market's dots sit {gap(bt.reliability)} points from the dashed line of perfect calibration; the blind model's sit {gap(bt.reliabilityLlm)} points away.</p>
      <div className="tr-small">Each dot is one tenth of the 0 to 100% range, sized by how many test questions fell in it.</div>

      <h4>No look-ahead</h4>
      <p>{checksOk} of {bt.leakage.checks.length} checks passed. Each is computed from the data on every run.</p>
      <ul className="tr-checks">{bt.leakage.checks.map((c) => <li key={c.name}><b>{c.passed ? 'Passed' : 'Failed'}</b> {c.name}.<small>{c.detail}</small></li>)}</ul>

      <h4>Do simulated events change decisions?</h4>
      <div className="lede"><span className="dc-label dc-label--sim">Simulated</span></div>
      {t7 ? <p>{t7.claim ?? (t7.pass ? 'The test passed.' : 'The test did not pass.')}{t7.p != null && ` p = ${t7.p.toFixed(3)}`}{t7.meanDiff != null && `, mean difference ${t7.meanDiff.toFixed(2)}`}.</p>
        : <p>This test has not run yet, so we make no claim that events in the simulated society change its decisions.</p>}

      <h4>What this does not show</h4>
      <ul className="tr-caveats">{bt.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="dc-data">{bt.model.id} · training cutoff {dmy(bt.model.trainingCutoff)} · {fmt(bt.llm.parsed)} of {fmt(bt.llm.asked)} answers parsed · {fmt(bt.cost.calls)} calls · ${bt.cost.usd.toFixed(2)}</div>
      <p className="verdict">A prediction, not a prophecy.</p>
    </div>
  )
}

/** One Brier score with its 95% interval on a 0–0.30 scale. */
function Strip({ s }: { s: Score }) {
  const W = 140, x = (v: number) => 4 + (Math.min(v, 0.3) / 0.3) * (W - 8)
  return (
    <svg viewBox={`0 0 ${W} 16`} width={W} height={16} aria-hidden="true">
      <line x1={x(0)} x2={x(0.3)} y1={8} y2={8} className="tr-axis" />
      <line x1={x(0.25)} x2={x(0.25)} y1={3} y2={13} className="tr-axis" />
      <line x1={x(s.ci95[0])} x2={x(s.ci95[1])} y1={8} y2={8} className="tr-ci" />
      <circle cx={x(s.brier)} cy={8} r={4} className="tr-dot" />
    </svg>
  )
}

/** Forecast against outcome, 10 bins, for the market (filled) and the blind model (rings). */
function Reliability({ market, model }: { market: ReliabilityBin[]; model: ReliabilityBin[] }) {
  const W = 330, H = 300, L = 58, R = 12, T = 12, B = 40
  const sx = (v: number) => L + v * (W - L - R), sy = (v: number) => H - B - v * (H - T - B)
  const r = (n: number) => Math.max(4, Math.min(11, 2 + Math.sqrt(n) / 2.5))
  const tip = (who: string, b: ReliabilityBin) => `${who} said ${Math.round(b.meanForecast * 100)}% (${b.n} questions): ${Math.round(b.observed * 100)}% came true`
  const path = (bins: ReliabilityBin[]) => bins.map((b, i) => `${i ? 'L' : 'M'}${sx(b.meanForecast).toFixed(1)},${sy(b.observed).toFixed(1)}`).join('')
  return (
    <figure className="tr-rel">
      <div className="tr-legend"><span><i className="tr-key" /> Market price</span><span><i className="tr-key tr-key--ring" /> Blind AI model</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Reliability: what each forecaster said against how often it came true">
        {[0, 0.5, 1].map((v) => <g key={v}>
          <line x1={sx(0)} x2={sx(1)} y1={sy(v)} y2={sy(v)} className="tr-grid" />
          <text x={L - 8} y={sy(v) + 4} textAnchor="end">{v * 100}%</text>
          <text x={sx(v)} y={H - B + 18} textAnchor="middle">{v * 100}%</text>
        </g>)}
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="tr-diag" />
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">What it said</text>
        <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle">How often it came true</text>
        <path d={path(model)} className="tr-line tr-line--model" />
        <path d={path(market)} className="tr-line" />
        {model.map((b) => <circle key={`m${b.lo}`} cx={sx(b.meanForecast)} cy={sy(b.observed)} r={r(b.n)} className="tr-ring"><title>{tip('The model', b)}</title></circle>)}
        {market.map((b) => <circle key={`k${b.lo}`} cx={sx(b.meanForecast)} cy={sy(b.observed)} r={r(b.n)} className="tr-dot"><title>{tip('The market', b)}</title></circle>)}
      </svg>
    </figure>
  )
}
