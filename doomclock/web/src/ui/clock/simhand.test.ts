// A recorded future on the real timeline: the hand reads the step's date10, the four rows add up.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildTimeline } from '../../engine/index.ts'
import { moveOf, simTimeline, stepAt } from '../../app/futures.ts'
import type { RecordedFuture, World } from '../../contracts.ts'
import { scaleOf, type BulletinSetting } from './scale.ts'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const world: World = read('../../engine/fixtures/world.fixture.json')
const bulletin: BulletinSetting[] = read('../../../public/cache/bulletin.json')
const futures: RecordedFuture[] = read('../../../public/cache/futures.fixture.json')
const base = buildTimeline(world, { percentile: 0.5 })
const tl = simTimeline(base, futures[0], 0, futures.length)

test('the timeline stops at 2029Q4 and frames after today are simulated', () => {
  assert.equal(tl.frames.at(-1)!.quarter, '2029Q4')
  const today = tl.frames.findLastIndex((f) => f.provenance === 'real')
  assert.ok(tl.frames.slice(today + 1).every((f) => f.provenance === 'simulated'))
  assert.equal(tl.future.catDate, null)
})

test('a simulated hand is k x years from the frame start to the step date, with today as the ghost', () => {
  const scale = scaleOf(tl, bulletin)
  const f = tl.frames.find((x) => x.provenance === 'simulated')!
  const h = scale.hand(f, false)
  assert.equal(h.source, 'simulated')
  assert.equal(h.ghost, scale.pin)
  assert.ok(Math.abs(h.seconds - scale.k * f.clock!.minutesToMidnight!) < 1e-6)
})

test('events, report, luck and time add up to the step total', () => {
  for (const s of futures[0].steps) {
    const m = moveOf(world, futures[0], s, base.clock.date10)
    assert.ok(Math.abs(m.rows.reduce((a, r) => a + r.months, 0) - m.months) < 1e-6, `step ${s.step}`)
    assert.equal(stepAt(futures[0], s.start), s)
  }
})
