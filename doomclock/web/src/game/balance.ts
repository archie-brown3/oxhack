// Balance harness (task 129): 1,000 seeded games of the auto-Guardian against the heuristic Rogue
// (ε = 0.1), rules-only decisions from the cast stance codes, world events on. Checks the plan's
// four bars and writes data/tests/balance.json. Only GAME RULE constants (rules.ts) are tuned.
// Run: node doomclock/web/src/game/balance.ts
import { writeFileSync } from 'node:fs'
import { CARDS } from './cards.ts'
import { autoTurn, newGame, type TurnOptions } from './reducer.ts'
import { DC_BASE, RULES, constantsHash } from './rules.ts'
import type { GameState, GuardianCardId } from './types.ts'

const GAMES = 1000
type Opts = TurnOptions & { banned?: GuardianCardId[]; passive?: boolean }

function run(o: Opts): GameState[] {
  const out: GameState[] = []
  for (let seed = 1; seed <= GAMES; seed++) {
    let s = newGame(seed)
    while (!s.outcome) s = autoTurn(s, o).state
    out.push(s)
  }
  return out
}

const guardianWins = (g: GameState[]) => g.filter((s) => s.outcome === 'contained' || s.outcome === 'time-bought').length / g.length
const pct = (x: number) => Math.round(x * 1000) / 10

export function measure() {
  const base: Opts = { epsilon: 0.1 }
  const games = run(base)
  const win = guardianWins(games)
  const outcomes: Record<string, number> = {}
  for (const s of games) outcomes[s.outcome!] = (outcomes[s.outcome!] ?? 0) + 1
  const ablation = CARDS.guardian.map((c) => {
    const w = guardianWins(run({ ...base, banned: [c.id] }))
    return { card: c.id, winRate: pct(w), shift: pct(win - w) }
  })
  const passive = run({ ...base, passive: true })
  const skynetTurns = passive.filter((s) => s.outcome === 'skynet').map((s) => s.turn).sort((a, b) => a - b)
  // Games that never reach Skynet count as "after turn 6" (7) for the median.
  const all = [...skynetTurns, ...Array(passive.length - skynetTurns.length).fill(7)].sort((a, b) => a - b)
  const medianSkynet = all[all.length >> 1]
  const rogueHeuristic = 1 - win
  const rogueRandom = 1 - guardianWins(run({ rogueMode: 'random' }))
  const maxShift = Math.max(...ablation.map((a) => Math.abs(a.shift)))
  const bars = [
    { bar: 'Guardian win rate 40-60%', value: pct(win), pass: win >= 0.4 && win <= 0.6 },
    { bar: 'No card shifts the win rate by more than 25 points (ablation)', value: maxShift, pass: maxShift <= 25 },
    { bar: 'Passive Guardian: median Skynet turn 5 ± 1', value: medianSkynet, pass: Math.abs(medianSkynet - 5) <= 1 },
    { bar: 'Random-legal Rogue wins at least 15 points less than the heuristic Rogue', value: pct(rogueHeuristic - rogueRandom), pass: rogueHeuristic - rogueRandom >= 0.15 },
  ]
  return { bars, outcomes, ablation, rogue: { heuristic: pct(rogueHeuristic), random: pct(rogueRandom) }, passiveOutcomes: count(passive) }
}

function count(g: GameState[]) {
  const o: Record<string, number> = {}
  for (const s of g) o[s.outcome!] = (o[s.outcome!] ?? 0) + 1
  return o
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = performance.now()
  const m = measure()
  const constants = { RULES, DC_BASE }
  const out = {
    schema: 'doomclock.balance/1',
    ranAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    games: GAMES,
    setup: 'Auto-Guardian vs heuristic Rogue (epsilon 0.1), RULES-ONLY decisions from the cast.json stance codes (T6 medians not available), world events on. Seeds 1..1000.',
    label: 'GAME RULE',
    ...m,
    allPass: m.bars.every((b) => b.pass),
    constantsHash: constantsHash(),
    constants,
    ms: Math.round(performance.now() - t0),
  }
  writeFileSync(new URL('../../../../data/tests/balance.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
  for (const b of m.bars) console.log(b.pass ? 'PASS' : 'FAIL', b.bar, b.value)
  console.log(JSON.stringify({ outcomes: m.outcomes, rogue: m.rogue, passive: m.passiveOutcomes, ablation: m.ablation }))
}
