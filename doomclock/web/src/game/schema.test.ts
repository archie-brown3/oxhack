// Tasks 101 and 108: the schemas, their examples, the path keys and cards.json.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { validate, type Schema } from './schema.ts'
import { CARDS } from './cards.ts'
import { childKey, hash32, isKey, rngFor, ROOT } from './paths.ts'

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'))
const schemas: Record<string, Schema> = {
  cast: read('./data/schemas/cast.schema.json'),
  cards: read('./data/schemas/cards.schema.json'),
  node: read('./data/schemas/node.schema.json'),
}

for (const name of Object.keys(schemas)) {
  test(`${name} example validates against doomclock.${name}/1`, () => {
    assert.deepEqual(validate(schemas[name], read(`./data/examples/${name}.example.json`)), [])
  })
}

test('the validator rejects a bad node', () => {
  const bad = read('./data/examples/node.example.json')
  bad.pathKey = 'root.G9'
  bad.outputs.interviews[0].word = 'MAYBE'
  delete bad.inputs.seeds
  assert.equal(validate(schemas.node, bad).length, 3)
})

test('cast.json, when the society lane has written it, validates', (t) => {
  const url = new URL('./data/cast.json', import.meta.url)
  if (!existsSync(url)) return t.skip('cast.json not written yet')
  assert.deepEqual(validate(schemas.cast, JSON.parse(readFileSync(url, 'utf8'))), [])
})

test('cards.json validates and holds G1-G7 and R1-R7', () => {
  assert.deepEqual(validate(schemas.cards, read('./data/cards.json')), [])
  assert.deepEqual(CARDS.guardian.map((c) => c.id), ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'])
  assert.deepEqual(CARDS.rogue.map((c) => c.id), ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'])
})

test('market-priced cards cost -log2(p) within 0.05 bits and carry their market id and traders', () => {
  const priced = CARDS.guardian.filter((c) => c.price.source === 'market')
  assert.deepEqual(priced.map((c) => c.id), ['G1', 'G4', 'G5'])
  for (const c of priced) {
    const m = c.price.market!
    assert.ok(Math.abs(c.price.bits + Math.log2(m.p)) <= 0.05, `${c.id}: ${c.price.bits} vs ${-Math.log2(m.p)}`)
    assert.ok(m.id.length > 0)
    assert.ok('traders' in m, `${c.id} has no trader count field`)
    assert.ok(Date.parse(m.ts) < Date.parse(CARDS.pinnedAt), `${c.id} priced after the pin`)
  }
  assert.equal(CARDS.guardian.find((c) => c.id === 'G4')!.price.market!.traders, 23)
})

test('every seed template starts with an issuer header; every G card lists gatekeepers, subjects and vocab', () => {
  for (const c of CARDS.guardian) {
    for (const s of c.seeds) assert.match(s.template, /^\[[^\]]+·[^\]]+\]/, `${c.id} seed`)
    assert.ok(Array.isArray(c.gatekeepers), c.id)
    for (const g of c.gatekeepers) assert.ok(CARDS.vocab[g.vocab], `${c.id} gatekeeper vocab ${g.vocab}`)
    if (c.subjects.vocab) assert.ok(CARDS.vocab[c.subjects.vocab], `${c.id} subject vocab`)
    else assert.equal(c.id, 'G6') // the public warning decides nothing; it works through opinion
  }
  for (const words of Object.values(CARDS.vocab)) for (const w of words) assert.ok(w in CARDS.m, w)
})

test('path keys: format, and the seed derives from the key', () => {
  const k = childKey(childKey(childKey(ROOT, 'G1'), 'G2@3'), 'a3')
  assert.equal(k, 't0.G1.G2@3.a3')
  assert.ok(isKey(k))
  assert.ok(!isKey('t1.G1') && !isKey('t0.G8'))
  assert.throws(() => childKey(ROOT, 'G9'))
  assert.equal(hash32('t0'), hash32('t0'))
  assert.notEqual(rngFor(1, 't0', 'rogue')(), rngFor(1, 't0.G1', 'rogue')())
  assert.equal(rngFor(1, 't0', 'rogue')(), rngFor(1, 't0', 'rogue')())
})
