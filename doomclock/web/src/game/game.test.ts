// Tasks 107, 115, 116: the two lines, the reducer, the Rogue and the Guardian.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { World } from '../contracts.ts'
import { readClock } from '../engine/timeline.ts'
import { sim } from '../engine/sim.ts'
import { mulberry32 } from '../engine/rng.ts'
import { lagSensitivity, realLine, simInputOf, yourLine } from './line.ts'
import { autoTurn, endCheck, newGame, playTurn } from './reducer.ts'
import { autoGuardian, offer } from './guardian.ts'
import { legalRogueMoves, roguePrompt, rogueView, validateRogue } from './rogue.ts'
import { recommend } from './recommend.ts'
import { DC_BASE, RULES, constantsHash, weightOf, type Stances } from './rules.ts'
import type { GameState, GuardianCardId, NodeFile } from './types.ts'

const world: World = JSON.parse(readFileSync(new URL('../engine/fixtures/world.fixture.json', import.meta.url), 'utf8'))
const deepFreeze = <T,>(o: T): T => {
  if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v) }
  return o
}
deepFreeze(world)

/** A game played to `turns` (or its end) with random offered cards, from `seed`. */
function randomGame(seed: number, turns = 6): GameState {
  const r = mulberry32(seed * 7919)
  let s = newGame(seed)
  for (let i = 0; i < turns && !s.outcome; i++) {
    const o = offer(s)
    const card = r() < 0.2 || !o.length ? null : o[Math.floor(r() * o.length)]
    s = playTurn(s, card, { epsilon: 0.1 }).state
  }
  return s
}

// ---------- 107: the lines ----------

test('the real line is the clock: same 1-in-10 day as readClock on the pinned anchors', () => {
  const real = realLine(world)
  assert.equal(real.label, 'REAL')
  assert.equal(`${real.date}T00:00:00Z`, readClock(world).date10)
  // The plan's "Dec 2032" was written on earlier anchors; today's pin reads May 2032 (logged on task 107).
  assert.equal(real.date!.slice(0, 7), '2032-05')
})

test('the real line is byte-identical across 50 random game states', () => {
  const before = JSON.stringify(realLine(world))
  for (let seed = 1; seed <= 50; seed++) {
    const s = randomGame(seed, 1 + (seed % 6))
    yourLine(s, world)
    assert.equal(JSON.stringify(realLine(world)), before, `seed ${seed}`)
  }
})

test('T3: your timeline moves the right way for each dlogit input, 20 of 20 seeds', () => {
  const later = (a: GameState, b: GameState) => yourLine(b, world).year! - yourLine(a, world).year!
  for (let seed = 1; seed <= 20; seed++) {
    const s = randomGame(seed, 1 + (seed % 5))
    const base = { ...s, outcome: null }
    assert.ok(later(base, { ...base, C: base.C + 5 }) < 0, `C up -> earlier (seed ${seed})`)
    assert.ok(later(base, { ...base, footholds: [...base.footholds, { lab: 6, revealed: false, since: 1 }] }) < 0, `footholds up -> earlier (${seed})`)
    assert.ok(later(base, { ...base, oversight: base.oversight + 10 }) > 0, `oversight up -> later (${seed})`)
    assert.ok(later(base, { ...base, outcome: 'contained' }) > 0, `contained -> later (${seed})`)
    assert.ok(later(base, { ...base, outcome: 'skynet' }) < 0, `skynet -> earlier (${seed})`)
  }
})

test('lag sensitivity: lag 1 and lag 10 are the clock arc ends', () => {
  const [l1, l3, l10] = lagSensitivity(world)
  const arc = readClock(world).date10RangeBy.lag
  assert.equal(`${l1.date}T00:00:00Z`, arc[0])
  assert.equal(`${l10.date}T00:00:00Z`, arc[1])
  assert.ok(l1.date! < l3.date! && l3.date! < l10.date!)
  // Today's pin: May 2030 / May 2032 / Mar 2037 (the plan's Jan 2031 / Oct 2037 used earlier anchors).
  assert.deepEqual([l1, l10].map((l) => l.date!.slice(0, 7)), ['2030-05', '2037-03'])
})

test('100k paths run in under 50 ms', () => {
  const input = simInputOf(world)
  sim(input, { paths: 100_000 }) // warm up
  const ms = Math.min(...[1, 2, 3].map(() => sim(input, { paths: 100_000 }).ms))
  assert.ok(ms < 50, `${ms.toFixed(1)} ms`)
})

// ---------- 115: the reducer ----------

const play = (seed: number) => {
  let s = newGame(seed)
  while (!s.outcome) s = autoTurn(s, { epsilon: 0.1 }).state
  return s
}

test('the same seed gives the same game; another seed differs', () => {
  assert.deepEqual(play(3), play(3))
  assert.notDeepEqual(play(3), play(4))
})

test('bits never go below 0 and C never falls, over 200 random games', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = randomGame(seed)
    for (const l of s.log) assert.ok(l.deltaC >= 0, `seed ${seed}`)
    assert.ok(s.bits >= 0, `seed ${seed}: ${s.bits}`)
  }
})

test('end checks run in order: contained, public turned, Skynet, time bought', () => {
  const f = (n: number) => Array.from({ length: n }, (_, i) => ({ lab: i, revealed: false, since: 0 }))
  assert.equal(endCheck({ footholds: [], trust: 0, C: 60 }, 6), 'contained')
  assert.equal(endCheck({ footholds: f(3), trust: 0, C: 60 }, 6), 'public-turned')
  assert.equal(endCheck({ footholds: f(3), trust: 5, C: 50 }, 6), 'skynet')
  assert.equal(endCheck({ footholds: f(2), trust: 5, C: 80 }, 6), 'time-bought')
  assert.equal(endCheck({ footholds: f(2), trust: 5, C: 80 }, 5), null)
})

const quiet = { events: false, rogue: { moves: [], label: 'HEURISTIC' as const, rationale: 'pass' } }

test('the AND-gate and the share follow the plan examples; GO FURTHER gives T = 0.5', () => {
  // Labs 0-4 at DELAY, COMPLY, COMPLY, RESIST, DELAY, weighted by Epoch share; the Senate gates.
  const st = { 0: { G1: 'DELAY' }, 1: { G1: 'COMPLY' }, 2: { G1: 'COMPLY' }, 3: { G1: 'RESIST' }, 4: { G1: 'DELAY' } } as Stances
  const w = [0, 1, 2, 3, 4].map(weightOf)
  const share = (w[0] * 0.5 + w[1] + w[2] + w[4] * 0.5) / w.reduce((a, b) => a + b, 0)
  const g1 = playTurn(newGame(1), 'G1', { ...quiet, stances: { ...st, 9: { G1: 'ENFORCE' } } }).state
  assert.ok(Math.abs(g1.oversight - Math.round(20 * share * 10) / 10) < 1e-9, `${g1.oversight}`)
  assert.equal(g1.flags.licence![0], 0.8)
  const weakSenate = playTurn(newGame(1), 'G1', { ...quiet, stances: { ...st, 9: { G1: 'WEAKEN' } } }).state
  assert.ok(Math.abs(weakSenate.flags.licence![1] - (1 - 0.4 * 0.4)) < 1e-9) // gate = min(m) = 0.4
  const fur = playTurn(newGame(1), 'G1', { ...quiet, stances: { 9: { G1: 'ENFORCE' }, 0: { G1: 'GO FURTHER' } } }).state
  assert.equal(fur.flags.licence![0], 0.5)
  // G4 needs the US Executive AND China: WEAKEN caps the gate at 0.4; DECLINE closes it.
  let s = newGame(1)
  s = { ...s, bits: 9, played: ['G1', 'G2', 'G6'] as GuardianCardId[] }
  const weak = playTurn(s, 'G4', { ...quiet, stances: { 8: { G4: 'WEAKEN' }, 12: { G4: 'JOIN' }, 1: { G4: 'COMPLY' } } }).state
  assert.ok(Math.abs(weak.flags.pause!.throttle[1] - (1 - 0.4 * 0.4)) < 1e-9)
  const shut = playTurn(s, 'G4', { ...quiet, stances: { 8: { G4: 'ENFORCE' }, 12: { G4: 'DECLINE' }, 1: { G4: 'COMPLY' } } }).state
  assert.equal(shut.flags.pause!.throttle[1], 1)
  assert.equal(shut.oversight, 0)
})

test('a passive game grows C by the market-paced steps times (0.7 + 0.15 F)', () => {
  let s = newGame(1)
  const got: number[] = []
  while (!s.outcome) {
    const r = playTurn(s, null, quiet)
    got.push(r.report.deltaC)
    s = r.state
  }
  assert.deepEqual(got, DC_BASE.map((d) => Math.round(d * (RULES.growth.base + RULES.growth.perFoothold) * 10) / 10))
  assert.equal(s.outcome, 'time-bought') // one foothold never reaches Skynet
})

test('T3 per card: each card moves your timeline later (or leaves it), never earlier, 20 of 20 seeds', () => {
  for (const card of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'] as GuardianCardId[]) {
    for (let seed = 1; seed <= 20; seed++) {
      let s = newGame(seed)
      s = { ...s, bits: 9, played: (['G1', 'G2', 'G6', 'G4', 'G3', 'G5'] as GuardianCardId[]).filter((c) => c !== card) }
      if (card === 'G7') s = { ...s, footholds: s.footholds.map((f) => ({ ...f, revealed: true })) }
      assert.ok(offer(s).includes(card), `${card} not on offer`)
      // World events off: a market hazard firing in the pass branch would play the same card.
      const yes = playTurn(s, card, { events: false }).state
      const no = playTurn(s, null, { events: false }).state
      const d = yourLine(yes, world).year! - yourLine(no, world).year!
      assert.ok(d >= 0, `${card} seed ${seed}: ${d}`)
      if (['G1', 'G4'].includes(card)) assert.ok(d > 0, `${card} seed ${seed} did not move`)
    }
  }
})

const example = (): NodeFile => JSON.parse(readFileSync(new URL('./data/examples/node.example.json', import.meta.url), 'utf8'))

test('a recorded node folds: its decisions drive the effect; a RULES-ONLY node falls back to stances', () => {
  const rec = playTurn(newGame(1), 'G1', { ...quiet, node: example() })
  assert.equal(rec.report.society.label, 'RECORDED')
  assert.equal(rec.report.society.decisions[0], 'DELAY')
  // Only labs 0 and 1 answered (DELAY, COMPLY); the Senate (#9) answered ENFORCE, so the gate is 1.
  const share = (weightOf(0) * 0.5 + weightOf(1)) / (weightOf(0) + weightOf(1))
  assert.ok(Math.abs(rec.state.oversight - Math.round(20 * share * 10) / 10) < 1e-9)
  assert.equal(rec.state.support, 0.75)
  const ro = playTurn(newGame(1), 'G1', { ...quiet, node: { ...example(), status: 'rules-only' } })
  assert.equal(ro.report.society.label, 'RULES-ONLY')
  assert.deepEqual(ro.state.flags, playTurn(newGame(1), 'G1', quiet).state.flags)
})

// ---------- 116: the Rogue and the Guardian ----------

const keysDeep = (o: unknown, out = new Set<string>()): Set<string> => {
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); keysDeep(v, out) }
  return out
}

test("the Rogue's view and prompt never hold the Guardian's bits, hand, offer or target", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = randomGame(seed, seed % 4)
    const keys = keysDeep(rogueView(s))
    for (const k of ['bits', 'hand', 'offer', 'target', 'played', 'trust']) assert.ok(!keys.has(k), `view has ${k}`)
    const p = roguePrompt(s)
    for (const k of ['"bits"', '"hand"', '"offer"', '"played"']) assert.ok(!p.includes(k), `prompt has ${k}`)
  }
})

test('the validator rejects >2 cards, unaffordable plays, R2 below C 25, R5 without a foothold, labs outside 0-6', () => {
  const s = newGame(1) // C 6, CU 3, one foothold
  const host = s.footholds[0].lab
  const free = [0, 1, 2, 3, 4, 5, 6].find((l) => l !== host)!
  assert.deepEqual(validateRogue(s, [{ id: 'R1' }]), [])
  assert.ok(validateRogue(s, [{ id: 'R1' }, { id: 'R4' }, { id: 'R6' }]).length)
  assert.ok(validateRogue(s, [{ id: 'R1' }, { id: 'R3', target: free }]).some((e) => e.includes('CU')))
  assert.ok(validateRogue({ ...s, CU: 9 }, [{ id: 'R2', target: free }]).length)
  assert.deepEqual(validateRogue({ ...s, CU: 9, C: 30 }, [{ id: 'R2', target: free }]), [])
  assert.ok(validateRogue(s, [{ id: 'R5', target: free }]).length)
  assert.deepEqual(validateRogue(s, [{ id: 'R5', target: host }]), [])
  assert.ok(validateRogue(s, [{ id: 'R3', target: 7 }]).some((e) => e.includes('0-6')))
  assert.ok(validateRogue(s, [{ id: 'R3', target: 12 }]).some((e) => e.includes('0-6')))
  for (const m of legalRogueMoves(s)) assert.deepEqual(validateRogue(s, [m]), [], JSON.stringify(m))
})

test('100 calls on the same state give the same offer', () => {
  const s = randomGame(5, 2)
  const first = JSON.stringify(offer(s))
  for (let i = 0; i < 100; i++) assert.equal(JSON.stringify(offer(s)), first)
  assert.deepEqual(offer(newGame(1)), ['G1', 'G2', 'G6'])
})

test('the auto-Guardian plays G7 on a revealed foothold when it has 2 bits', () => {
  const s = newGame(1)
  const r = { ...s, footholds: s.footholds.map((f) => ({ ...f, revealed: true })) }
  assert.deepEqual(autoGuardian(r), { card: 'G7', target: s.footholds[0].lab })
  assert.notEqual(autoGuardian({ ...r, bits: 1.5 }).card, 'G7')
  assert.ok(offer(r).indexOf('G7') === 2)
})

test('recommend: months per bit for every offered card, from seeded rollouts that cannot see hidden state', () => {
  const s = newGame(1)
  const a = recommend(s, world, 40)
  assert.deepEqual(a, recommend(s, world, 40))
  assert.deepEqual(a.options.map((o) => o.card), [...offer(s), null])
  assert.equal(a.rollouts, 40)
  // Moving the hidden foothold must not change the advice: rollouts redraw it.
  const moved = { ...s, footholds: [{ lab: (s.footholds[0].lab + 1) % 7, revealed: false, since: 0 }] }
  assert.deepEqual(recommend(moved, world, 40), a)
})

test('the market-paced clock matches the KXAGICO cummax curve in data/market-inputs.json', () => {
  const mi = JSON.parse(readFileSync(new URL('../../../../data/market-inputs.json', import.meta.url), 'utf8'))
  const labels = ['2026Q4', '2027Q1', '2027Q2', '2027Q3', '2027Q4', '2028Q1', '2028Q2']
  const q: number[] = labels.map((l) => mi.capabilityCurve.quarters.find((x: { q: string }) => x.q === l).p)
  assert.equal(Math.round(100 * q[0]), 6)
  assert.deepEqual(q.slice(1).map((p, i) => Math.round(100 * (p - q[i]))), DC_BASE)
})

test('the frozen constants are the ones data/tests/balance.json measured, and every bar passed', () => {
  const b = JSON.parse(readFileSync(new URL('../../../../data/tests/balance.json', import.meta.url), 'utf8'))
  assert.equal(b.constantsHash, constantsHash(), 'rules.ts changed since balance.ts ran: re-run it')
  assert.equal(b.games, 1000)
  assert.ok(b.allPass, JSON.stringify(b.bars))
})
