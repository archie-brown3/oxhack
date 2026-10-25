// The forecast-driven decision: for each card on offer, play the rest of the game a few hundred
// times and report the months it buys on "your timeline" per bit spent, against passing.
// Honest by construction: rollouts never see what the Guardian cannot. Hidden state (exact C,
// unrevealed footholds, stealth, CU) is redrawn from the Guardian's view each rollout, and every
// effect size is a GAME RULE, so the numbers rank cards; they are not a forecast.
import type { World } from '../contracts.ts'
import { guardianCard } from './cards.ts'
import { autoTarget, offer, revealedLabs } from './guardian.ts'
import { yourLine } from './line.ts'
import { mulberry32 } from '../engine/rng.ts'
import { hash32 } from './paths.ts'
import { autoTurn, playTurn } from './reducer.ts'
import { FOOTHOLD_LABS, LABS } from './rules.ts'
import type { AgentId, GameState, GuardianCardId } from './types.ts'

export interface Recommendation {
  card: GuardianCardId | null
  bits: number
  /** Mean months your timeline ends later than the real line, if you play this card now. */
  months: number
  /** (months − months if you pass) ÷ bits. Null for passing. */
  monthsPerBit: number | null
  /** Share of rollouts the Guardian wins (contained or time bought). */
  winRate: number
}

export interface RecommendResult {
  label: 'GAME RULE'
  rollouts: number
  /** Plain sentence on how these numbers were made. */
  method: string
  options: Recommendation[]
  best: GuardianCardId | null
}

/** One draw of the hidden state consistent with what the Guardian sees (game-rule priors). */
export function resample(s: GameState, seed: number): GameState {
  const r = mulberry32(seed)
  const b: GameState = structuredClone(s)
  b.seed = seed
  const shown = revealedLabs(s)
  // Prior: one hidden foothold, plus about one more every three quarters played.
  let hidden = 1
  for (let i = 0; i < s.turn; i++) if (r() < 0.3) hidden++
  if (shown.length) hidden -= 1
  const free = LABS.filter((l) => FOOTHOLD_LABS.includes(l.id) && !shown.includes(l.id))
  const kept = b.footholds.filter((f) => f.revealed)
  for (let k = 0; k < hidden && free.length; k++) {
    const total = free.reduce((a, l) => a + l.weight, 0)
    let u = r() * total
    const i = Math.max(0, free.findIndex((l) => (u -= l.weight) < 0))
    kept.push({ lab: free[i].id as AgentId, revealed: false, since: 0 })
    free.splice(i, 1)
  }
  b.footholds = kept
  b.C = Math.round((s.band.lo + r() * (s.band.hi - s.band.lo)) * 10) / 10
  b.stealth = Math.max(0, 0.2 - 0.1 * Math.floor(r() * 3))
  b.CU = 1 + Math.floor(r() * 4)
  return b
}

function finish(s: GameState): GameState {
  let x = s
  while (!x.outcome) x = autoTurn(x).state
  return x
}

const wins = (s: GameState) => s.outcome === 'contained' || s.outcome === 'time-bought'

/** Months bought per bit for each offered card, from `rollouts` seeded rule-only games each. */
export function recommend(s: GameState, world: World, rollouts = 200): RecommendResult {
  const cards: (GuardianCardId | null)[] = [...offer(s), null]
  const options = cards.map((card) => {
    let months = 0
    let won = 0
    for (let i = 0; i < rollouts; i++) {
      const b = resample(s, hash32(`${s.seed}|${s.key}|belief|${i}`))
      const target = card ? autoTarget(b, card) : undefined
      const end = finish(playTurn(b, card, { target, by: 'auto' }).state)
      months += yourLine(end, world).months
      if (wins(end)) won++
    }
    return { card, bits: card ? guardianCard(card).price.bits : 0, months: Math.round((months / rollouts) * 10) / 10, monthsPerBit: null as number | null, winRate: Math.round((won / rollouts) * 100) / 100 }
  })
  const pass = options.find((o) => o.card === null)!
  for (const o of options) if (o.card) o.monthsPerBit = Math.round(((o.months - pass.months) / o.bits) * 10) / 10
  const best = options.filter((o) => o.card).sort((a, b) => b.monthsPerBit! - a.monthsPerBit!)[0]?.card ?? null
  return {
    label: 'GAME RULE',
    rollouts,
    method: `Each option was played to the end ${rollouts} times. The rollouts redraw what you cannot see, and every effect size is a game rule, so this ranks the cards rather than forecasting them.`,
    options,
    best,
  }
}
