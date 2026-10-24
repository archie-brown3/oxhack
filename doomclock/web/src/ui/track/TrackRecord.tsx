// Track record: the market's Brier on resolved AI questions against a 50% coin and the base rate,
// with CIs, n, a reliability curve and the caveats. A tab inside the Why this time? sheet.
import type { BacktestFile } from '../../contracts.ts'

export function TrackRecord({ bt, fixture }: { bt: BacktestFile; fixture: boolean }) {
  if (fixture) return <>
    <div className="lede"><span className="dc-data">Backtest not yet run</span></div>
    <h3>Track record is not available yet</h3>
    <p>We have not measured held-out prediction performance. Sample scores are hidden so they cannot be mistaken for results.</p>
    <p>The planned check compares past market prices with a 50% guess and the base rate on resolved AI questions. It must use only data available before each checkpoint.</p>
    <p>The countdown date itself cannot be scored by this test.</p>
  </>
  const s = bt.scores.test
  const rows = [['Market price at T', s.market], ['Base rate', s.baseRate], ['50% coin', s.coin]] as const
  const W = 300, H = 240, p = 36, sx = (v: number) => p + v * (W - 2 * p), sy = (v: number) => H - p - v * (H - 2 * p)
  const rel = bt.reliability ?? []
  return (
    <>
      <div className="lede"><span className="dc-label dc-label--real">Real</span><span className="dc-data">{fixture ? 'fixture until the backtest runs' : `split ${bt.split}`}</span></div>
      <h3>Are the market inputs any good?</h3>
      <p>On AI questions that have already resolved, we score the market price at each checkpoint against a 50% coin and the base rate. Lower Brier is better.</p>
      <div className="trackgrid">
        <div>
          <table className="tbl">
            <thead><tr><th>Forecaster</th><th className="n">Brier</th><th className="n">95% CI</th></tr></thead>
            <tbody>{rows.map(([name, x]) => <tr key={name}><td>{name}</td><td className="n">{x.brier.toFixed(3)}</td><td className="n ci">{x.ci95[0].toFixed(2)}–{x.ci95[1].toFixed(2)}</td></tr>)}</tbody>
          </table>
          <p className="dc-dim" style={{ font: 'var(--type-body)' }}>n = {bt.n.test} test questions{fixture && <span className="dc-mock">mock</span>}</p>
        </div>
        <div>
          <div className="eyebrow dc-faint">Reliability</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="rel" role="img" aria-label="Reliability curve: market price against how often it came true">
            <rect x={p} y={p} width={W - 2 * p} height={H - 2 * p} style={{ fill: 'none', stroke: 'var(--rule)' }} />
            <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} style={{ stroke: 'var(--ink-3)' }} strokeDasharray="3 3" />
            {rel.map((b) => <circle key={b.lo} cx={sx(b.meanForecast)} cy={sy(b.observed)} r={3 + Math.sqrt(b.n) / 3} style={{ fill: 'var(--ink)' }}><title>{b.n} questions</title></circle>)}
            <text x={W / 2} y={H - 8} textAnchor="middle" style={{ fill: 'var(--ink-3)', font: '400 12px var(--font-sans)' }}>market price</text>
          </svg>
        </div>
      </div>
      <p className="dc-dim" style={{ font: 'var(--type-body)' }}><b>Caveats.</b> {fixture ? 'Every number here is a fixture until the backtest runs. ' : ''}Questions count only if the model's cutoff plus one month is before the checkpoint; the earlier half picks the panel weight and the later half reports. The clock's date itself can't be backtested, so it is never scored.</p>
    </>
  )
}
