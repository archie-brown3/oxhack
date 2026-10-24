import type { CardsFile } from '../contracts.ts'

export const cards: CardsFile = {
  schema: 'doomclock.cards/1',
  cards: [
    {
      id: 'pause',
      side: 'guardian',
      title: 'Pause',
      blurb: 'A major lab pauses frontier training.',
      market: { source: 'manifold', id: 'fx-card-1', url: 'https://manifold.markets/fixture/card-1', question: 'Will a major lab pause frontier training?', deadline: '2028-12-31T23:59:59Z' },
      p: 0.43,
      priceBits: 1.22,
      expiresAt: '2028-12-31T23:59:59Z',
      faceDown: false,
      detection: { meter: 'oversight', threshold: 0 },
      effect: { source: 'game_rule', meters: { capability: -1, oversight: 2, trust: 1, alarm: 0 }, dlogit: { asi: -0.1, cat: -0.1 } },
      firmCriteria: true,
      criteriaNote: 'Resolves on a public announcement.',
    },
    {
      id: 'escape',
      side: 'rogue',
      title: 'Containment escape',
      blurb: 'A model slips its sandbox.',
      market: { source: 'kalshi', id: 'FXUSTAKEOVER', url: 'https://kalshi.com/markets/fxustakeover', question: 'Fixture question?', deadline: '2029-12-31T23:59:59Z' },
      p: 0.05,
      priceBits: 4.32,
      expiresAt: '2029-12-31T23:59:59Z',
      faceDown: true,
      detection: { meter: 'oversight', threshold: 3 },
      effect: { source: 'game_rule', meters: { capability: 3, oversight: -1, trust: 0, alarm: 1 }, regionWeights: { US: 0.05, China: -0.05 }, dlogit: { asi: 0.2, cat: 0.3 } },
      firmCriteria: false,
      criteriaNote: 'No firm resolution criteria: game-rule price.',
    },
  ],
}
