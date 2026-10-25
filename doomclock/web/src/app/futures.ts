// The recorded futures (coupled loop): futures.json first, else the committed fixture, and the
// step helpers behind the clock's callout. The engine's buildTimeline(world, pick, sim) renders one.
// The browser never re-simulates MiroFish.
import type { IsoTime, NodeId, RecordedFuture, RecordedStep, Timeline, World } from '../contracts.ts'
import { readClock } from '../engine/index.ts'

const get = async (path: string): Promise<RecordedFuture[] | null> => {
  try { const r = await fetch(path); const j = r.ok ? await r.json() : null; return Array.isArray(j) && j.length ? (j as RecordedFuture[]) : null } catch { return null }
}
export const loadFutures = async () => (await get('cache/futures.json')) ?? (await get('cache/futures.fixture.json')) ?? []

/** The timeline ends here: 2029Q4 (frame 20). */
export const LAST_QUARTER = '2029Q4'
const toYear = (ms: number) => { const y = new Date(ms).getUTCFullYear(), a = Date.UTC(y, 0, 1); return y + (ms - a) / (Date.UTC(y + 1, 0, 1) - a) }

export const stepAt = (f: RecordedFuture, start: IsoTime): RecordedStep | null =>
  f.steps.find((s) => Date.parse(s.start) <= Date.parse(start) && Date.parse(start) < Date.parse(s.end)) ?? null
export const isSecondQuarter = (s: RecordedStep, start: IsoTime) => Date.parse(start) >= (Date.parse(s.start) + Date.parse(s.end)) / 2
/** The step before `s`'s 1-in-10 date (decimal year); step 1 starts from today's reading. */
const prevYear = (f: RecordedFuture, s: RecordedStep, today: IsoTime | null) => (s.step > 1 ? f.steps[s.step - 2].date10 : today ? toYear(Date.parse(today)) : s.date10)

/** The timeline stops at 2029Q4. */
export const truncate = (t: Timeline): Timeline => ({ ...t, frames: t.frames.slice(0, t.frames.findIndex((f) => f.quarter === LAST_QUARTER) + 1) })

export interface Move { months: number; rows: { key: 'events' | 'report' | 'luck' | 'time'; label: string; months: number; rule: boolean }[]; split: boolean }
const mo = (y: number) => y * 12

/** Why this step's 1-in-10 date moved, in months (negative = toward midnight). total = events + report + luck + time. */
export function moveOf(world: World, f: RecordedFuture, s: RecordedStep, todayDate10: IsoTime | null): Move {
  const prev = prevYear(f, s, todayDate10)
  const time = s.noEventsDate10 - prev, luck = s.rulesOffDate10 - s.noEventsDate10, both = s.date10 - s.rulesOffDate10
  // Report = what the situation report's cat2100 level adds, read with the engine's own clock.
  let report = 0, split = true
  try {
    const at = (a: Record<NodeId, number>) => toYear(Date.parse(readClock({ ...world, asOf: s.end, anchors: a }).date10 ?? s.end))
    report = at(s.anchors) - at({ ...s.anchors, cat2100: f.startAnchors.cat2100 })
  } catch { split = false }
  if (!Number.isFinite(report)) { report = 0; split = false }
  return {
    months: mo(s.date10 - prev), split,
    rows: [
      { key: 'events', label: 'Simulated events', months: mo(both - report), rule: true },
      { key: 'report', label: 'Situation report', months: mo(report), rule: true },
      { key: 'luck', label: 'Luck (same noise, rules off)', months: mo(luck), rule: false },
      { key: 'time', label: 'Time passing', months: mo(time), rule: false },
    ],
  }
}

/** Share of the recorded moves that is luck: Σ|luck| / (Σ|luck| + Σ|events+report|), across all steps. */
export function luckShare(fs: RecordedFuture[]): number | null {
  let l = 0, e = 0
  for (const f of fs) for (const s of f.steps) { l += Math.abs(s.rulesOffDate10 - s.noEventsDate10); e += Math.abs(s.date10 - s.rulesOffDate10) }
  return l + e > 0 ? l / (l + e) : null
}
