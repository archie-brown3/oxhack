// Tasks 117, 119, 125: market hazards, the AIID rate, the event templates and the event roll.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import hazards from './data/hazards.json' with { type: 'json' }
import rates from './data/incident-rates.json' with { type: 'json' }
import { EVENTS, HAZARDS, rollEvents } from './events.ts'
import { rngFor } from './paths.ts'
import { newGame } from './reducer.ts'
import type { GuardianCardId } from './types.ts'

const T0 = '2026-10-24T00:00:00Z'
const clean = (name: string) =>
  readFileSync(new URL(`../../../../data/clean/${name}.jsonl`, import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const aiid = new Map(clean('aiid').map((r) => [r.id as string, r]))

// ---------- 117 ----------

test('hazards follow h = 1 - ((1 - P_end)/(1 - P_start))^(1/quarters) on ladders priced before T0', () => {
  for (const h of hazards.hazards) {
    for (const r of h.ladder) assert.ok(r.ts < T0, `${r.id} priced at ${r.ts}`)
    for (let i = 1; i < h.ladder.length; i++) assert.ok(h.ladder[i].p > h.ladder[i - 1].p, `${h.id} ladder not increasing`)
  }
  const [reg, ks, rsi] = hazards.hazards.map((h) => h.perTurn)
  const h = (a: number, b: number, q: number) => 1 - ((1 - b) / (1 - a)) ** (1 / q)
  assert.ok(Math.abs(reg[0] - h(0.21, 0.38, 2)) < 1e-3 && Math.abs(reg[2] - h(0.38, 0.72, 2)) < 1e-3)
  // The plan's checks: kill switch ≈ 0.025 and RSI ≈ 0.16 hold within 0.02.
  assert.ok(Math.abs(ks[0] - 0.025) <= 0.02, `kill switch ${ks[0]}`)
  assert.ok(Math.abs(rsi[0] - 0.16) <= 0.02, `rsi ${rsi[0]}`)
  // Regulator ≈ 0.18 / 0.27 in the plan; the Jul-2027 rung has since moved from 0.47 to 0.38, so
  // it reads 0.11 / 0.33 (difference logged on task 117).
  assert.deepEqual([reg[0], reg[2]].map((x) => Math.round(x * 100) / 100), [0.11, 0.33])
})

test('λ is reproducible from the frozen keyword list, on AIID records with ts < T0', () => {
  const re = new RegExp(`\\b(${rates.keywords.map((k) => k.replace('-', '\\-')).join('|')})`, 'i')
  const hits = [...aiid.values()].filter((r) => r.ts < T0 && r.ts >= rates.window.from && r.ts < rates.window.to && re.test(`${r.title} ${r.description ?? ''}`))
  assert.deepEqual(hits.map((r) => r.id), rates.ids)
  assert.equal(rates.perQuarter, Math.round((hits.length / rates.window.quarters) * 100) / 100)
})

// ---------- 119 ----------

const allText = () => [
  ...EVENTS.background.map((b) => b.text),
  ...Object.values(EVENTS.surfacing).map((s) => s.text),
  EVENTS.rsi.text,
  ...EVENTS.calendar.map((c) => c.text),
]

test('every template cites an AIID id whose fixed ts is before T0', () => {
  assert.ok(EVENTS.background.length >= 20)
  for (const t of [...EVENTS.background, ...Object.values(EVENTS.surfacing)]) {
    const r = aiid.get(t.aiid)
    assert.ok(r, `AIID #${t.aiid} not in data/clean/aiid.jsonl`)
    assert.ok(r.ts < T0, `AIID #${t.aiid} ts ${r.ts}`)
  }
  for (const b of EVENTS.background) assert.equal(aiid.get(b.aiid).ts.slice(0, 10), b.ts)
})

test('name check: templates name organisations only, never private individuals', () => {
  const allowed = new Set(['Hugging Face', 'An Anthropic', 'Google Gemini', 'An Open', 'Australian Medicare', 'The Bulletin', 'Doomsday Clock'])
  for (const t of allText()) for (const m of t.matchAll(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)+/g)) assert.ok(allowed.has(m[0]), `"${m[0]}" in: ${t}`)
})

test('every surfacing template carries the SIMULATED INCIDENT label; R1-R3 and R5-R7 are covered', () => {
  assert.deepEqual(Object.keys(EVENTS.surfacing).sort(), ['R1', 'R2', 'R3', 'R5', 'R6', 'R7'])
  for (const s of Object.values(EVENTS.surfacing)) assert.match(s.text, /^SIMULATED INCIDENT · modelled on AIID #\d+\./)
})

// ---------- 125 ----------

test('the same path key gives the same events', () => {
  const s = newGame(1)
  assert.deepEqual(rollEvents(s, 1, rngFor(1, 't0', 'events')), rollEvents(s, 1, rngFor(1, 't0', 'events')))
  assert.notDeepEqual(rollEvents(s, 1, rngFor(1, 't0', 'events')), rollEvents(s, 1, rngFor(1, 't0.G1', 'events')))
})

test('over 10k rolls the hazards fire at their market rates within 1 point; dates stay in Q1 2027-Q2 2028', () => {
  const s = newGame(1)
  for (let turn = 1; turn <= 6; turn++) {
    const n = 10_000
    const fired: Record<string, number> = { G1: 0, G5: 0, rsi: 0 }
    for (let i = 0; i < n; i++) {
      for (const e of rollEvents(s, turn, rngFor(i, `t0.r${turn}`, 'events'))) {
        assert.ok(e.date >= '2027-01-01' && e.date <= '2028-06-30', e.date)
        if (e.kind === 'hazard') fired[e.card!]++
        if (e.kind === 'rsi') fired.rsi++
      }
    }
    const [reg, ks, rsi] = HAZARDS.map((h) => h.perTurn[turn - 1])
    assert.ok(Math.abs(fired.G1 / n - reg) < 0.01, `turn ${turn} G1 ${fired.G1 / n} vs ${reg}`)
    assert.ok(Math.abs(fired.G5 / n - ks) < 0.01, `turn ${turn} G5`)
    assert.ok(Math.abs(fired.rsi / n - rsi) < 0.01, `turn ${turn} rsi`)
  }
})

test('a hazard never fires for a measure already in force', () => {
  const s = { ...newGame(1), played: ['G1', 'G5'] as GuardianCardId[] }
  for (let i = 0; i < 2000; i++) for (const e of rollEvents(s, 3, rngFor(i, 't0', 'events'))) assert.notEqual(e.kind, 'hazard')
})
