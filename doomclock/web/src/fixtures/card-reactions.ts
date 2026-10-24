import type { CardReactions } from '../contracts.ts'

export const cardReactions: CardReactions = {
  schema: 'doomclock.card-reactions/1',
  model: 'google/gemini-2.5-flash',
  asOf: '2026-10-24T17:55:00Z',
  cards: [
    {
      cardId: 'pause',
      headline: 'Will a major lab pause frontier training? — happened, 2027Q1',
      personas: [
        { name: 'doomer', status: 'ok', dlogit: { asi: -0.2, cat: -0.3 } },
        { name: 'accelerationist', status: 'ok', dlogit: { asi: -0.1, cat: -0.1 } },
        { name: 'superforecaster', status: 'bad_json', dlogit: { asi: 0, cat: 0 } },
      ],
      meanDlogit: { asi: -0.1, cat: -0.133 },
    },
  ],
}
