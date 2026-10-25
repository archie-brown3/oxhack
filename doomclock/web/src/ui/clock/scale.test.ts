// The hand on three fixture dates, and the countdown ticking.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildTimeline, PICKS } from '../../engine/index.ts'
import type { World } from '../../contracts.ts'
import { countdown } from '../format.ts'
import { scaleOf, type BulletinSetting } from './scale.ts'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const world: World = read('../../engine/fixtures/world.fixture.json')
const bulletin: BulletinSetting[] = read('../../../public/cache/bulletin.json')
const timeline = buildTimeline(world, { percentile: PICKS.early })
const scale = scaleOf(timeline, bulletin)
const frames = timeline.frames
const today = frames.findLastIndex((f) => f.provenance === 'real')
const YEAR = 365.25 * 864e5

test('a past quarter shows the Bulletin setting in force by its end', () => {
  const q = frames.findIndex((f) => f.quarter === '2025Q1')
  const h = scale.hand(frames[q], false)
  assert.equal(h.source, 'bulletin')
  assert.equal(h.seconds, 89) // set 28 Jan 2025
  const q4 = frames.findIndex((f) => f.quarter === '2024Q4')
  assert.equal(scale.hand(frames[q4], false).seconds, 90) // the 2023 setting still stood
})

test("today is pinned to the Bulletin's current 85 s", () => {
  const h = scale.hand(frames[today], true)
  assert.equal(h.seconds, 85)
  assert.equal(scale.pin, 85)
})

test('a projected quarter reads k x years from its start to the 1-in-10 date', () => {
  const f = frames[today + 8] // two years on
  const h = scale.hand(f, false)
  const d10 = Date.parse(timeline.clock.date10!), now = Date.parse(timeline.asOf)
  const want = (85 * (d10 - Date.parse(f.start))) / (d10 - now)
  assert.equal(h.source, 'forecast')
  assert.ok(Math.abs(h.seconds - want) < 0.5, `${h.seconds} vs ${want}`)
  assert.ok(h.seconds < 85, 'later quarters sit nearer midnight')
  assert.ok(Math.abs(scale.daysPerSecond! - ((d10 - now) / YEAR) * 365.25 / 85) < 0.5, "about 24 days per second")
})

test('the countdown ticks one second at a time', () => {
  const now = new Date('2026-10-25T00:00:00Z'), target = '2032-05-31T00:00:00Z'
  assert.equal(countdown(target, now), '5y 219d 00:00:00')
  assert.equal(countdown(target, new Date(+now + 1000)), '5y 218d 23:59:59')
  assert.equal(countdown(target, new Date(target)), '0y 000d 00:00:00')
})
