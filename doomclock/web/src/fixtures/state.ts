import type { StateFile } from '../contracts.ts'

export const state: StateFile = {
  schema: 'doomclock.state/2',
  asOf: '2026-10-24T17:55:00Z',
  stale: false,
  w: 0,
  panel: {
    model: 'google/gemini-2.5-flash',
    trainingCutoff: '2025-01-31',
    personas: [
      {
        name: 'doomer',
        status: 'ok',
        nudges: { cat2100: { dlogit: 0.2, reason: 'Fixture reason.', cite: 'https://example.com/a' } },
      },
      { name: 'accelerationist', status: 'bad_json', nudges: {} },
      { name: 'superforecaster', status: 'timeout', nudges: {} },
    ],
  },
  nodes: [
    { id: 'asi2030', marketId: 'fx-asi-2030', label: 'ASI by 2030', url: 'https://manifold.markets/fixture/asi-2030', horizonYear: 2030, pMarket: 0.36, dlogit: 0, p: 0.36 },
    { id: 'asi2040', marketId: 'fx-asi-2040', label: 'ASI by 2040', url: 'https://manifold.markets/fixture/asi-2040', horizonYear: 2040, pMarket: 0.75, dlogit: 0, p: 0.75 },
    { id: 'asi2100', marketId: 'fx-asi-2100', label: 'ASI by 2100', url: 'https://manifold.markets/fixture/asi-2100', horizonYear: 2100, pMarket: 0.86, dlogit: 0, p: 0.86 },
    { id: 'cat2100', marketId: 'fx-cat-2100', label: 'AI kills ≥10% by 2100', url: 'https://manifold.markets/fixture/cat-2100', horizonYear: 2100, pMarket: 0.3, dlogit: 0, p: 0.3 },
  ],
  warnings: [
    { marketId: 'fx-warn-1', label: '$100M loss-of-control incident', url: 'https://manifold.markets/fixture/warn-1', horizonYear: 2035, pMarket: 0.27, p: 0.27 },
  ],
  headlines: [
    { title: 'Fixture headline', url: 'https://example.com/a', ts: '2026-10-23T09:00:00Z', source: 'guardian' },
  ],
}
