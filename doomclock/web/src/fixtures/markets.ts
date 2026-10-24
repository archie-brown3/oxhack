import type { MarketsFile } from '../contracts.ts'

// Fixture ids are made up. Real ids are pinned by data-markets.
export const markets: MarketsFile = {
  manifold: [
    { id: 'fx-asi-2030', role: 'anchor', label: 'ASI by 2030', url: 'https://manifold.markets/fixture/asi-2030', question: 'Will ASI exist by 2030?', deadline: '2030-12-31T23:59:59Z' },
    { id: 'fx-asi-2040', role: 'anchor', label: 'ASI by 2040', url: 'https://manifold.markets/fixture/asi-2040', question: 'Will ASI exist by 2040?', deadline: '2040-12-31T23:59:59Z' },
    { id: 'fx-asi-2100', role: 'anchor', label: 'ASI by 2100', url: 'https://manifold.markets/fixture/asi-2100', question: 'Will ASI exist by 2100?', deadline: '2100-12-31T23:59:59Z' },
    { id: 'fx-cat-2100', role: 'anchor', label: 'AI kills ≥10% by 2100', url: 'https://manifold.markets/fixture/cat-2100', question: 'Will AI kill at least 10% of humans before 2100?', deadline: '2100-12-31T23:59:59Z' },
    { id: 'fx-warn-1', role: 'warning', label: '$100M loss-of-control incident', url: 'https://manifold.markets/fixture/warn-1', question: 'Will an AI incident cause $100M of loss?', deadline: '2035-12-31T23:59:59Z' },
    { id: 'fx-card-1', role: 'card', label: 'Pause', url: 'https://manifold.markets/fixture/card-1', question: 'Will a major lab pause frontier training?', deadline: '2028-12-31T23:59:59Z', criteriaNote: 'Resolves on a public announcement.' },
  ],
  kalshi: [
    { ticker: 'FXAGI-COMP', role: 'capability_curve' },
    { ticker: 'FXUSTAKEOVER', role: 'card', label: 'Containment escape', url: 'https://kalshi.com/markets/fxustakeover', question: 'Fixture question?', deadline: '2029-12-31T23:59:59Z' },
  ],
  polymarket: [{ eventId: 'fx-best-model', role: 'origin_lab' }],
}
