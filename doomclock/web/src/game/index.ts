// The game's public seam. Screens and the pipeline import from here; the rest is internal.
//   newGame(seed, t0Node?)              -> GameState at T0
//   offer(state)                        -> the 3 cards on offer
//   legalRogueMoves(state)              -> the Rogue's legal single moves
//   playTurn(state, card|null, opts)    -> { state, report }  (opts: target, node, rogue, ...)
//   autoTurn(state, opts)               -> one auto-Guardian turn (continuations, Fast-forward)
//   realLine(world) / yourLine(state, world) -> the two 1-in-10 dates (REAL / GAME RULE)
//   recommend(state, world, rollouts)   -> months bought per bit for each offered card
export { newGame, playTurn, autoTurn, deciders, lexiconShare } from './reducer.ts'
export type { TurnOptions } from './reducer.ts'
export { offer, autoGuardian, autoTarget, guardianView, tellCount, revealedLabs, expired } from './guardian.ts'
export { legalRogueMoves, validateRogue, heuristicRogue, rogueView, roguePrompt } from './rogue.ts'
export { realLine, yourLine, lineDlogits, lagSensitivity } from './line.ts'
export type { LineReading, YourLine } from './line.ts'
export { recommend } from './recommend.ts'
export type { Recommendation, RecommendResult } from './recommend.ts'
export { CARDS, guardianCard, rogueCard } from './cards.ts'
export type { GuardianCard, RogueCard } from './cards.ts'
export { LABS, QUARTERS, RULES, STANCES, TURNS, stancesFrom } from './rules.ts'
export type { Stances } from './rules.ts'
export { EVENTS, HAZARDS, LAMBDA } from './events.ts'
export { ROOT, childKey, isKey } from './paths.ts'
export type * from './types.ts'
