// The Guardian's side (task 116, plan §5): the deterministic offer, auto-targets, the auto-policy
// used for continuations and balance runs, and the Guardian's view of the state. Pure.
import { CARDS, M, guardianCard } from './cards.ts'
import { LABS, QUARTERS, RULES, STANCES, TURN_START, weightOf, type Stances } from './rules.ts'
import type { AgentId, GameState, GuardianCardId, GuardianView, Word } from './types.ts'

export function expired(card: GuardianCardId, turn: number): boolean {
  const e = guardianCard(card).expires
  return e !== null && TURN_START[turn - 1] > e
}

export const revealedLabs = (s: GameState): AgentId[] => [...new Set(s.footholds.filter((f) => f.revealed).map((f) => f.lab))]

/** Live tells per lab (they decay after 2 turns; the reducer drops old ones). */
export function tellCount(s: GameState): Record<AgentId, number> {
  const out: Record<AgentId, number> = {}
  for (const t of s.tells) out[t.lab] = (out[t.lab] ?? 0) + 1
  return out
}

function available(s: GameState, c: GuardianCardId, banned: GuardianCardId[]): boolean {
  if (banned.includes(c) || expired(c, s.turn + 1)) return false
  if (s.played.includes(c) && !RULES.repeatable.includes(c)) return false
  return s.bits >= guardianCard(c).price.bits
}

/** The first 3 unplayed, unexpired, affordable cards in offer order; G7 takes slot 3 once a
 *  foothold is revealed. The same state always gives the same offer. */
export function offer(s: GameState, banned: GuardianCardId[] = []): GuardianCardId[] {
  if (s.outcome) return []
  const list = CARDS.offerOrder.filter((c) => available(s, c, banned)).slice(0, 3)
  if (revealedLabs(s).length && available(s, 'G7', banned)) {
    const i = Math.min(CARDS.g7Slot - 1, list.length)
    list.splice(i, list.length - i, 'G7')
  }
  return list
}

// Most tells, ties broken by Epoch weight (then by id, so it is total).
function pick(labs: AgentId[], s: GameState): AgentId | undefined {
  const tells = tellCount(s)
  return [...labs].sort((a, b) => (tells[b] ?? 0) - (tells[a] ?? 0) || weightOf(b) - weightOf(a) || a - b)[0]
}

/** The G2/G7 auto-target: G2 any lab, G7 a revealed foothold. Undefined for untargeted cards. */
export function autoTarget(s: GameState, card: GuardianCardId): AgentId | undefined {
  const kind = guardianCard(card).target
  if (kind === 'lab') return pick(LABS.map((l) => l.id), s)
  if (kind === 'revealed') return pick(revealedLabs(s), s)
  return undefined
}

// m of a subject: last turn's answer if it was in this card's vocabulary, else its stance code.
function mOf(s: GameState, card: GuardianCardId, id: AgentId, vocab: string, stances: Stances): number {
  const words = CARDS.vocab[vocab] ?? []
  const last = s.lastDecisions[id]
  const w: Word | undefined = last && words.includes(last) ? last : stances[id]?.[card]
  return w ? M[w] : 0.5
}

/** Expected throttle per bit: Σ weight × 0.4 × gate × m over the card's subjects, ÷ price. */
export function throttlePerBit(s: GameState, card: GuardianCardId, stances: Stances = STANCES): number {
  const c = guardianCard(card)
  const gate = Math.min(1, ...c.gatekeepers.map((g) => (typeof g.id === 'number' ? Math.min(1, mOf(s, card, g.id, g.vocab, stances)) : 1)))
  const ids = Array.isArray(c.subjects.ids) ? c.subjects.ids : []
  const vocab = c.subjects.vocab ?? ''
  const kind = c.engine.kind
  let value = 0
  for (const id of ids) {
    const m = mOf(s, card, id, vocab, stances)
    if (kind === 'licence') value += weightOf(id) * 0.4 * gate * m
    if (kind === 'pause') value += 2 * weightOf(id) * 0.4 * gate * m // two quarters
    if (kind === 'killswitch' && gate * m >= 0.5) value += weightOf(id) * 0.2
  }
  if (kind === 'kyc') value = 0.5 * Math.min(1, mOf(s, card, 7, 'switch', stances)) * LABS.slice(0, 5).reduce((a, l) => a + l.weight, 0) * 0.4
  return value / c.price.bits
}

/** The auto-Guardian (plan §5): G7 on a revealed foothold if it can pay 2 bits; G2 on a lab with 2+
 *  tells; else the offered card with the best throttle per bit; else G6; else pass. */
export function autoGuardian(s: GameState, banned: GuardianCardId[] = [], stances: Stances = STANCES): { card: GuardianCardId | null; target?: AgentId } {
  const o = offer(s, banned)
  if (o.includes('G7') && s.bits >= 2) return { card: 'G7', target: autoTarget(s, 'G7') }
  const tells = tellCount(s)
  const suspect = pick(LABS.map((l) => l.id).filter((l) => (tells[l] ?? 0) >= RULES.auditTells), s)
  if (o.includes('G2') && suspect !== undefined) return { card: 'G2', target: suspect }
  const scored = o.map((c) => ({ c, v: throttlePerBit(s, c, stances) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)
  if (scored.length) return { card: scored[0].c }
  if (o.includes('G6')) return { card: 'G6' }
  return { card: null }
}

/** What the Guardian may see. Never exact C, hidden footholds, stealth or CU. */
export function guardianView(s: GameState): GuardianView {
  return {
    turn: s.turn,
    quarter: s.turn === 0 ? '2026Q4' : QUARTERS[s.turn - 1],
    bits: s.bits,
    trust: s.trust,
    oversight: s.oversight,
    alarm: s.alarm,
    support: s.support,
    band: s.band,
    revealed: revealedLabs(s),
    tells: tellCount(s),
    outcome: s.outcome,
  }
}
