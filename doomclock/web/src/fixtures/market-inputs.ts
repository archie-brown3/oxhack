import type { MarketInputs } from '../contracts.ts'

export const marketInputs: MarketInputs = {
  schema: 'doomclock.market-inputs/1',
  asOf: '2026-10-24T17:55:00Z',
  capabilityCurve: {
    ticker: 'FXAGI-COMP',
    rule: 'company announces AGI',
    monotonised: true,
    quarters: [
      { q: '2027Q1', p: 0.1 },
      { q: '2027Q2', p: 0.12 },
      { q: '2027Q3', p: 0.12 },
      { q: '2027Q4', p: 0.15 },
    ],
  },
  cardPrices: [{ cardMarketId: 'fx-card-1', p: 0.43, asOf: '2026-10-24T17:55:00Z' }],
  originLab: [
    { lab: 'Fixture Lab A', region: 'US', p: 0.6, source: 'fx-best-model' },
    { lab: 'Fixture Lab B', region: 'China', p: 0.3, source: 'fx-best-model' },
    { lab: 'Fixture Lab C', region: 'rest', p: 0.1, source: 'fx-best-model' },
  ],
}
