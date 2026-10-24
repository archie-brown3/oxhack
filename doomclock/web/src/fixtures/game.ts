import type { GameState } from '../contracts.ts'

export const game: GameState = {
  schema: 'doomclock.game/2',
  quarter: 1,
  year: 2027,
  bits: { guardian: 4, rogue: 4 },
  meters: { capability: 2, oversight: 3, trust: 1, alarm: 0 },
  hand: ['pause'],
  faceDownPlayed: [{ cardId: 'escape', playedQuarter: 1 }],
  detected: [],
  events: [{ quarter: 0, label: 'Fixture incident' }],
  originLab: { lab: 'Fixture Lab A', region: 'US' },
  history: [
    {
      quarter: 0,
      played: [{ side: 'guardian', cardId: 'pause', bits: 1.22, faceDown: false }],
      meterDeltas: { capability: -1, oversight: 2, trust: 1, alarm: 0 },
      dlogit: { asi: -0.1, cat: -0.1 },
      ticker: ['Fixture ticker line'],
    },
  ],
  seed: 42,
}
