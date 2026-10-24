import type { BacktestFile } from '../contracts.ts'

export const backtest: BacktestFile = {
  schema: 'doomclock.backtest/1',
  model: { id: 'google/gemini-2.5-flash', trainingCutoff: '2025-01-31' },
  split: '2026-01-01',
  n: { train: 500, test: 500 },
  scores: {
    test: {
      coin: { brier: 0.25, ci95: [0.24, 0.26] },
      baseRate: { brier: 0.22, ci95: [0.2, 0.24] },
      market: { brier: 0.15, ci95: [0.13, 0.17] },
      blindLlm: { brier: 0.2, ci95: [0.18, 0.22] },
      panel: { brier: 0.15, ci95: [0.13, 0.17] },
    },
  },
  pairedDiffs: [{ a: 'panel', b: 'market', delta: 0, ci95: [-0.01, 0.01] }],
  wChosen: 0,
  reliability: [{ lo: 0, hi: 0.2, n: 120, meanForecast: 0.1, observed: 0.09 }],
  headline: { text: 'Fixture headline: the panel did not beat the market.' },
  leakage: { canary: { passed: true, note: 'Fixture.' } },
}
