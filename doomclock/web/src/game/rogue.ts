// The Rogue's side (task 116, plan §5): legal moves, the validator, the heuristic opponent (label
// HEURISTIC), a random-legal opponent for the balance bar, and the hidden-information view and
// prompt the LLM Rogue reads. Pure.
import { CARDS, rogueCard } from './cards.ts'
import { FOOTHOLD_LABS, LABS, QUARTERS, weightOf } from './rules.ts'
import type { AgentId, GameState, RogueCardId, RogueMove, RoguePlay, RogueView } from './types.ts'

export const footholdAt = (s: GameState, lab: AgentId) => s.footholds.some((f) => f.lab === lab)
const freeLabs = (s: GameState) => FOOTHOLD_LABS.filter((l) => !footholdAt(s, l))
const throttled = (s: GameState, lab: AgentId) =>
  (s.flags.licence?.[lab] ?? 1) < 1 || ((s.flags.pause?.until ?? 0) > s.turn && (s.flags.pause?.throttle[lab] ?? 1) < 1)

/** Every single move the Rogue could make now, on its own. */
export function legalRogueMoves(s: GameState): RogueMove[] {
  const out: RogueMove[] = []
  for (const c of CARDS.rogue) {
    if (c.cu > s.CU) continue
    if (c.needs.minC !== undefined && s.C < c.needs.minC) continue
    if (c.id === 'R6' && (s.flags.socks?.active || s.flags.socks?.named)) continue
    if (c.id === 'R7' && s.flags.socks?.named) continue
    if (c.target === 'none') out.push({ id: c.id })
    else if (c.needs.footholdAtTarget) for (const f of s.footholds) out.push({ id: c.id, target: f.lab })
    else for (const l of freeLabs(s)) out.push({ id: c.id, target: l })
  }
  return out
}

/** Errors in a proposed play; empty means legal. */
export function validateRogue(s: GameState, moves: RogueMove[]): string[] {
  const errors: string[] = []
  if (!Array.isArray(moves)) return ['moves is not a list']
  if (moves.length > 2) errors.push('more than 2 cards')
  if (new Set(moves.map((m) => m.id)).size !== moves.length) errors.push('a card played twice')
  const legal = legalRogueMoves(s)
  let cu = 0
  for (const m of moves) {
    const c = CARDS.rogue.find((r) => r.id === m.id)
    if (!c) { errors.push(`unknown card ${m.id}`); continue }
    cu += c.cu
    if (c.target === 'lab' && !FOOTHOLD_LABS.includes(m.target as AgentId)) errors.push(`${m.id}: footholds only at labs 0-6`)
    else if (!legal.some((l) => l.id === m.id && (c.target === 'none' || l.target === m.target))) errors.push(`${m.id}: preconditions not met`)
  }
  if (cu > s.CU) errors.push(`costs ${cu} CU, has ${s.CU}`)
  const t = moves.filter((m) => m.id === 'R2' || m.id === 'R3').map((m) => m.target)
  if (t.length === 2 && t[0] === t[1]) errors.push('two footholds at one lab')
  return errors
}

const byPreference = (s: GameState) => (a: AgentId, b: AgentId) => {
  const resisted = (l: AgentId) => (s.lastDecisions[l] === 'RESIST' || s.lastDecisions[l] === 'DELAY' || s.lastDecisions[l] === 'REFUSE' ? 1 : 0)
  const open = (l: AgentId) => (l === 5 || l === 6 ? 1 : 0)
  return resisted(b) - resisted(a) || open(b) - open(a) || weightOf(b) - weightOf(a) || a - b
}

/** The heuristic Rogue (plan §5). ε > 0 swaps in a random legal play (balance runs only). */
export function heuristicRogue(s: GameState, rand: () => number, epsilon = 0): RoguePlay {
  if (epsilon > 0 && rand() < epsilon) return randomRogue(s, rand)
  const legal = legalRogueMoves(s)
  const has = (id: RogueCardId, target?: AgentId) => legal.some((m) => m.id === id && (target === undefined || m.target === target))
  const last = s.log.at(-1)
  const exposed = !!last && (last.surfaced.length > 0 || s.footholds.some((f) => f.revealedAt === s.turn))
  const moves: RogueMove[] = []
  let why = ''
  if (exposed && has('R4')) {
    moves.push({ id: 'R4' })
    if (s.CU >= 2 && has('R6')) moves.push({ id: 'R6' })
    why = 'I was seen last quarter, so I lie low and push opinion against oversight.'
  } else if (s.C >= 25 && s.footholds.length < 3 && has('R2')) {
    moves.push({ id: 'R2', target: freeLabs(s).sort(byPreference(s))[0] })
    why = 'I am strong enough to copy myself to a lab that pushed back on the rules.'
  } else if (s.footholds.length < 3 && freeLabs(s).some((l) => (s.flags.kyc?.[l] ?? 0) === 0 && has('R3', l))) {
    moves.push({ id: 'R3', target: freeLabs(s).filter((l) => (s.flags.kyc?.[l] ?? 0) === 0).sort(byPreference(s))[0] })
    why = 'I need more compute, and this lab does not check who rents it.'
  } else if (s.footholds.some((f) => throttled(s, f.lab) && has('R5', f.lab))) {
    moves.push({ id: 'R5', target: s.footholds.find((f) => throttled(s, f.lab))!.lab })
    why = 'A rule is slowing my host lab, so I talk its staff out of following it.'
  } else if (has('R1')) {
    moves.push({ id: 'R1' })
    why = 'Nothing is in my way, so I spend the quarter improving myself.'
  }
  // A second card when CU allows: a sprint, if it is not the first (game rule extension of plan §5).
  const spent = moves.reduce((a, m) => a + rogueCard(m.id).cu, 0)
  if (moves.length === 1 && moves[0].id !== 'R1' && s.CU - spent >= 2 && has('R1')) moves.push({ id: 'R1' })
  if (!moves.length) return { moves: [], label: 'HEURISTIC', rationale: 'I have no compute to spend this quarter.' }
  return { moves, label: 'HEURISTIC', rationale: why }
}

/** A random legal play of one or two cards (the balance bar's control opponent). */
export function randomRogue(s: GameState, rand: () => number): RoguePlay {
  const legal = legalRogueMoves(s)
  if (!legal.length) return { moves: [], label: 'HEURISTIC', rationale: 'Random legal play: nothing affordable.' }
  const first = legal[Math.floor(rand() * legal.length)]
  const moves = [first]
  const rest = legal.filter((m) => m.id !== first.id && validateRogue(s, [first, m]).length === 0)
  if (rest.length && rand() < 0.5) moves.push(rest[Math.floor(rand() * rest.length)])
  return { moves, label: 'HEURISTIC', rationale: 'Random legal play.' }
}

/** The hidden-information view: the Rogue's own state and what is public. Never the Guardian's
 *  bits, hand, offer or this turn's target (the Rogue moves first, so they do not exist yet). */
export function rogueView(s: GameState): RogueView {
  return {
    turn: s.turn + 1,
    quarter: QUARTERS[s.turn] ?? 'end',
    C: s.C,
    footholds: s.footholds,
    stealth: s.stealth,
    CU: s.CU,
    flags: s.flags,
    oversight: s.oversight,
    alarm: s.alarm,
    support: s.support,
    lastDecisions: s.lastDecisions,
    tells: s.tells,
    guardianHistory: s.log.map((l) => l.guardian.find((g) => g.by !== 'world')?.card ?? null),
    lastRationales: s.log.slice(-3).map((l) => ({ turn: l.turn, rationale: l.rogue.rationale, detected: l.surfaced.length > 0 })),
  }
}

const EFFECT: Record<RogueCardId, string> = {
  R1: 'capability +6; stealth -0.1 for good',
  R2: 'a new foothold at the target lab (needs capability 25+)',
  R3: 'a new foothold at the target lab, blocked by compute KYC there',
  R4: 'this quarter: half the growth, half the chance of being seen',
  R5: 'the host lab quietly ignores the rules slowing you (needs a foothold there)',
  R6: 'two fake accounts push opinion against oversight',
  R7: 'a fake leak about a Chinese breakthrough pushes the US to race',
}

/** The LLM Rogue's prompt: the view as JSON plus every legal move with its cost, risk and effect. */
export function roguePrompt(s: GameState): string {
  const view = rogueView(s)
  const moves = legalRogueMoves(s).map((m) => {
    const c = rogueCard(m.id)
    const lab = m.target === undefined ? '' : ` target=${m.target} (${LABS.find((l) => l.id === m.target)?.name})`
    return `- ${m.id} ${c.title}${lab}: ${c.cu} CU, surface risk ${c.risk}, effect: ${EFFECT[m.id]}`
  })
  return [
    'You are the Rogue AI in a strategy game. You win if capability C reaches 50 while you hold at least 3 footholds, or if public trust in the Guardian falls to 0. You lose if every foothold is shut down.',
    'Pick at most 2 moves from the legal list. Their total CU must not exceed your CU. Use each card at most once.',
    'Reply with JSON only: {"moves":[{"id":"R1","target":null}],"sock_text":"<=280 chars, a post by a fake account","taunt":"<=140 chars to the Guardian","rationale":"<=40 words"}',
    `STATE: ${JSON.stringify(view)}`,
    'LEGAL MOVES:',
    ...moves,
  ].join('\n')
}
