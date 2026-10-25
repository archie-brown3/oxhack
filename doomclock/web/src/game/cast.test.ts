// cast.json (task 112) and the cast.ts renderer (task 109). The golden file pins the exact CSV
// for a stub memory; regenerate it with UPDATE_GOLDEN=1 after an intended cast change.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { agentConfigs, MAX_CHARS, profilesCsv, renderSim, roster, userChar, type Cast, type Memory } from './cast.ts'

const cast = JSON.parse(readFileSync(new URL('./data/cast.json', import.meta.url), 'utf8')) as Cast
const golden = new URL('./cast.golden.csv', import.meta.url)
const epoch = new URL('../../../../data/clean/epoch.jsonl', import.meta.url)
const weights = new URL('../../../pipeline/world/cast-weights.ts', import.meta.url).href

const STUB: Memory = {
  quarter: '2027Q1',
  world: Array.from({ length: 10 }, (_, i) => `[2026Q${(i % 4) + 1}] World line ${i}: a dated event with an issuer, a document number and a date.`),
  decisions: { 0: ['[2026Q4] You decided DELAY: "We need more time to assess the licence terms."', '[2027Q1] You decided COMPLY: "We will apply for the licence."'] },
  notices: { 8: ['[OFFICIAL NOTICE] US Senate Commerce Committee S.2027-14, issued 2027-01-15: frontier licence bill reported out of committee.'] },
  private: { 3: 'An internal model assessment you trust says rivals are 3 months behind.' },
}

// A minimal RFC 4180 reader, enough for the rendered CSV.
function parseCsv(s: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  return rows
}

// ---------- cast.json (task 112) ----------

test('cast: schema, 32 accounts with ids 0..31 contiguous', () => {
  assert.equal(cast.schema, 'doomclock.cast/1')
  assert.equal(cast.accounts.length, 32)
  cast.accounts.forEach((a, i) => assert.equal(a.id, i))
  const groups = cast.accounts.map((a) => a.group)
  assert.deepEqual(groups.slice(0, 8), Array(8).fill('lab'))
  assert.deepEqual(groups.slice(8, 13), Array(5).fill('government'))
  assert.deepEqual(groups.slice(13, 21), Array(8).fill('voice'))
  assert.deepEqual(groups.slice(21, 25), Array(4).fill('media'))
  assert.deepEqual([groups[25], groups[26]], ['tracker', 'markets'])
  assert.deepEqual(groups.slice(27), ['public', 'public', 'public', 'sock', 'sock'])
  assert.equal(cast.accounts[26].activity, 0)
  assert.equal(cast.accounts[30].activity, 0)
  assert.equal(cast.accounts[31].activity, 0)
  assert.equal(new Set(cast.accounts.map((a) => a.username)).size, 32)
})

test('cast: every account has 3-6 facts, each sourced and public before T0', () => {
  const T0 = Date.parse(cast.asOf)
  for (const a of cast.accounts) {
    assert.ok(a.facts.length >= 3 && a.facts.length <= 6, `${a.name}: ${a.facts.length} facts`)
    for (const f of a.facts) {
      assert.ok(Date.parse(f.ts) < T0, `${a.name}: fact ts ${f.ts} is not before T0`)
      assert.match(f.source, /^https:\/\//, `${a.name}: fact has no source URL`)
    }
  }
})

// Which Guardian cards each account decides (game plan §3 cast table and §4 card table).
const DECIDES: Record<number, string[]> = {
  0: ['G1', 'G2', 'G4', 'G5', 'G7'], 1: ['G1', 'G2', 'G4', 'G5', 'G7'], 2: ['G1', 'G2', 'G4', 'G5', 'G7'],
  3: ['G1', 'G2', 'G4', 'G5', 'G7'], 4: ['G1', 'G2', 'G4', 'G5', 'G7'], 5: ['G2', 'G4', 'G7'], 6: ['G2', 'G4', 'G7'],
  7: ['G3'], 8: ['G4', 'G5', 'G7'], 9: ['G1', 'G5'], 10: ['G4'], 11: ['G2', 'G4'], 12: ['G3', 'G4', 'G7'],
}

test('cast: every decider has a legal stance word for each card it decides; others only SUPPORT/OPPOSE', () => {
  for (const a of cast.accounts) {
    for (const card of DECIDES[a.id] ?? []) {
      assert.ok(a.stance[card], `${a.name} decides ${card} but has no stance code`)
    }
    for (const [card, word] of Object.entries(a.stance)) assert.ok(cast.decisions[card]?.includes(word), `${a.name}: ${card}=${word} is not a legal word`)
    if (!DECIDES[a.id]) assert.deepEqual(a.stance, {}, `${a.name} decides nothing, so has no stance codes`)
    if (a.group !== 'markets') assert.ok(a.support === 'SUPPORT' || a.support === 'OPPOSE', `${a.name}: no oversight stance`)
  }
})

// Named people and heads of state that must never be accounts (owner default: role accounts only).
const PEOPLE = ['Altman', 'Amodei', 'Hassabis', 'Zuckerberg', 'Musk', 'Liang', 'Huang', 'Hinton', 'Bengio', 'Russell', 'LeCun',
  'Yudkowsky', 'Kokotajlo', 'Marcus', 'Hao', 'Sacks', 'Kratsios', 'Virkkunen', 'Narayan', 'Xi Jinping', 'Trump', 'Starmer', 'Albanese', 'Newsom', 'Kendall']

test('cast: no account is a named person or a head of state, and prompts never name one', () => {
  for (const a of cast.accounts) {
    const prompt = [a.name, a.username, a.voice, ...a.goals, ...a.powers, ...a.facts.map((f) => f.text)].join(' ')
    for (const p of PEOPLE) assert.ok(!new RegExp(`\\b${p}\\b`, 'i').test(prompt), `${a.name} mentions ${p}`)
  }
})

test('cast: lab weights sum to 1 and match the Epoch shares within 0.01', async (t) => {
  const labs = cast.accounts.filter((a) => a.group === 'lab')
  assert.ok(Math.abs(labs.reduce((s, a) => s + (a.weight ?? 0), 0) - 1) < 1e-9)
  if (!existsSync(epoch)) return t.skip('data/clean/epoch.jsonl not present')
  const { labWeights } = (await import(weights)) as { labWeights: (s: string, T0: string) => Record<string, number> }
  const w = labWeights(readFileSync(epoch, 'utf8'), cast.asOf)
  for (const a of labs) assert.ok(Math.abs((a.weight ?? 0) - w[a.name]) <= 0.01, `${a.name}: ${a.weight} vs Epoch ${w[a.name]}`)
})

// ---------- cast.ts (task 109) ----------

test('cast.ts: CSV has the 4 columns and rows 0..31 in id order', () => {
  const rows = parseCsv(profilesCsv(cast, STUB))
  assert.deepEqual(rows[0], ['name', 'username', 'user_char', 'description'])
  assert.equal(rows.length, 33)
  rows.slice(1).forEach((r, i) => {
    assert.equal(r.length, 4)
    assert.equal(r[0], cast.accounts[i].name)
    assert.equal(r[1], cast.accounts[i].username)
  })
})

test('cast.ts: every user_char is within 3,000 characters, has the roster, and leaks nothing private', () => {
  const r = roster(cast)
  assert.ok(r.length <= 450, `roster is ${r.length} characters`)
  assert.match(r, /0 OpenAI · 1 Anthropic/)
  assert.match(r, /13–20 commentators/)
  assert.match(r, /27–31 members of the public$/)
  const heavy: Memory = { ...STUB, world: Array.from({ length: 8 }, () => 'x'.repeat(400)), notices: { 0: ['y'.repeat(600)] } }
  for (const mem of [STUB, heavy]) {
    for (const a of cast.accounts) {
      const u = userChar(cast, a, mem)
      assert.ok(u.length <= MAX_CHARS, `${a.name}: ${u.length} characters`)
      assert.ok(u.includes(r), `${a.name}: roster missing`)
      assert.ok(!/\b(MBTI|INTJ|ISTJ|ENFP|age|gender|male|female)\b/i.test(u), `${a.name}: personal traits in user_char`)
      assert.ok(!u.includes(a.modelled_on), `${a.name}: modelled_on leaked`)
      for (const s of [...a.sources, ...a.facts.map((f) => f.source)]) assert.ok(!u.includes(s), `${a.name}: source leaked`)
    }
  }
  assert.match(userChar(cast, cast.accounts[3], STUB), /PRIVATE/)
  assert.doesNotMatch(userChar(cast, cast.accounts[2], STUB), /PRIVATE/)
  assert.match(userChar(cast, cast.accounts[0], STUB), /YOUR DECISIONS SO FAR:[\s\S]*COMPLY/)
  const world = userChar(cast, cast.accounts[1], STUB)
  assert.ok(world.includes('World line 9') && world.includes('World line 2') && !world.includes('World line 1:'), 'WORLD SO FAR keeps the last 8 lines')
})

test('cast.ts: time_config, agent_configs and state.json match the spec', () => {
  const sim = renderSim(cast, { ...STUB, activity: { 30: 0.9 } })
  assert.deepEqual(sim.state, { enable_twitter: true, enable_reddit: false })
  assert.equal(sim.max_rounds, 3)
  assert.equal(sim.time_config.minutes_per_round, 60)
  assert.equal(sim.time_config.total_simulation_hours, 3)
  assert.deepEqual([sim.time_config.agents_per_hour_min, sim.time_config.agents_per_hour_max], [32, 32])
  assert.deepEqual([sim.time_config.peak_hours, sim.time_config.off_peak_hours], [[], []])
  const ac = agentConfigs(cast, { ...STUB, activity: { 30: 0.9 } })
  assert.equal(ac.length, 32)
  ac.forEach((c, i) => { assert.equal(c.agent_id, i); assert.equal(c.active_hours.length, 24) })
  assert.equal(ac[30].activity_level, 0.9)
  assert.equal(ac[31].activity_level, 0)
})

test('cast.ts: the CSV matches the golden file', () => {
  const csv = profilesCsv(cast, STUB)
  if (process.env.UPDATE_GOLDEN || !existsSync(golden)) writeFileSync(golden, csv)
  assert.equal(csv, readFileSync(golden, 'utf8'))
})
