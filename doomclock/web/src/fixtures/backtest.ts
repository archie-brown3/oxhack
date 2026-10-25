import type { BacktestFile } from '../contracts.ts'

// Shape-only fixture for data/backtest.json (contract.test.ts checks its keys match the real file).
// The Track record tab never shows it as a result: leakage.canary.note 'Fixture.' marks it.
const s = (brier: number) => ({ brier, ci95: [brier - 0.01, brier + 0.01] as [number, number], n: 100 })
export const backtest: BacktestFile = {
  schema: 'doomclock.backtest/1',
  label: 'pilot',
  generatedAt: '2026-10-25T00:00:00Z',
  model: { id: 'google/gemini-2.5-flash', trainingCutoff: '2025-01-31', earliestT: '2025-03-01T00:00:00Z', promptVersion: 2 },
  design: { horizonDays: 30, minTradersManifold: 20, wGrid: [0, 0.5, 1], bootstrap: 'fixture', baseRate: { manifold: 0.3 } },
  split: '2026-03-01T00:00:00Z',
  n: { pool: 200, scored: 200, train: 95, test: 100, gap: 5, events: 60, bySource: { manifold: { pool: 200, test: 100 } }, dropped: {} },
  llm: { asked: 200, parsed: 200, parseRate: 1 },
  scores: {
    test: { coin: s(0.25), baseRate: s(0.2), market: s(0.1), blindLlm: s(0.2), blend: s(0.1), panel: null },
    bySource: { manifold: { n: 100, yesShare: 0.3, market: s(0.1), coin: s(0.25), baseRate: s(0.2), blindLlm: s(0.2) } },
  },
  pairedDiffs: [{ a: 'market', b: 'coin', delta: -0.15, ci95: [-0.16, -0.14], n: 100 }],
  wChosen: 0,
  w: { chosen: 0, trainScores: [{ w: 0, brier: 0.1 }], trainN: 95, test: { blend: s(0.1), market: s(0.1), diff: { a: 'blend', b: 'market', delta: 0, ci95: [0, 0], n: 100 } }, text: 'Fixture.' },
  reliability: [{ lo: 0, hi: 0.1, n: 50, meanForecast: 0.05, observed: 0.04 }],
  reliabilityLlm: [{ lo: 0, hi: 0.1, n: 50, meanForecast: 0.05, observed: 0.04 }],
  headline: { text: 'Fixture headline.' },
  leakage: { canary: { passed: true, note: 'Fixture.' }, checks: [] },
  cost: { usd: 0, calls: 0, note: 'Fixture.' },
  caveats: [],
}
