// Inputs at two as-of dates: nothing dated on or after T, and the counts match the clean data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { World } from '../../contracts.ts'
import { knownAt, NODES } from './known.ts'
import { asOf } from '../../../../pipeline/asof/asof.ts'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const world: World = JSON.parse(read('../../../public/cache/world.json'))
const dcs: { ts: string }[] = JSON.parse(read('../../../public/cache/datacentres.json'))
const clean = (src: string) => read(`../../../../../data/clean/${src}.jsonl`).split('\n').filter(Boolean).map((l) => JSON.parse(l) as { ts: string })

for (const iso of ['2025-06-01T00:00:00Z', '2026-03-01T00:00:00Z']) {
  const T = Date.parse(iso)
  test(`as of ${iso.slice(0, 10)}: every item is dated before T`, () => {
    const k = knownAt(world, dcs, T)
    for (const e of [...k.incident, ...k.government, ...k.news, ...k.datacentres]) assert.ok(Date.parse(e.ts) < T, e.ts)
    for (const id of NODES) for (const p of k.prices[id]) assert.ok(Date.parse(p.ts ?? p.T) < T)
    assert.ok(k.hidden > 0, 'later items are hidden')
    assert.equal(k.seen + k.hidden, k.total)
  })
  test(`as of ${iso.slice(0, 10)}: counts match the clean data`, () => {
    const k = knownAt(world, dcs, T)
    const before = (rows: { ts: string }[]) => rows.filter((r) => Date.parse(r.ts) < T).length
    assert.equal(k.incident.length, before(clean('aiid')))
    assert.equal(k.datacentres.length, before(clean('datacentres')))
  })
  test(`as of ${iso.slice(0, 10)}: each source's count matches asOf(T)`, () => {
    const k = knownAt(world, dcs, T), a = asOf(T).events()
    for (const kind of ['incident', 'government', 'news'] as const) assert.equal(k[kind].length, a.filter((e) => e.kind === kind).length, kind)
  })
}

test('a later as-of date knows strictly more', () => {
  const a = knownAt(world, dcs, Date.parse('2025-06-01T00:00:00Z')), b = knownAt(world, dcs, Date.parse('2026-03-01T00:00:00Z'))
  assert.ok(b.seen > a.seen)
  assert.ok(b.incident.length > a.incident.length)
})
