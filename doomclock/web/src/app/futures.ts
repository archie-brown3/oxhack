// The recorded futures (coupled loop) and the thin adapter that renders one onto the real
// timeline. futures.json first, else the committed fixture. Swap `simTimeline` for the engine's
// buildTimeline(world, pick, sim) when it lands. The browser never re-simulates MiroFish.
import type { IsoTime, NodeId, RecordedFuture, RecordedStep, SampledFuture, Timeline, World, WorldFrame } from '../contracts.ts'
import { readClock } from '../engine/index.ts'

const get = async (path: string): Promise<RecordedFuture[] | null> => {
  try { const r = await fetch(path); const j = r.ok ? await r.json() : null; return Array.isArray(j) && j.length ? (j as RecordedFuture[]) : null } catch { return null }
}
export const loadFutures = async () => (await get('cache/futures.json')) ?? (await get('cache/futures.fixture.json')) ?? []

/** The timeline ends here: 2029Q4 (frame 20). */
export const LAST_QUARTER = '2029Q4'
const YEAR_MS = (y: number) => { const a = Date.UTC(Math.floor(y), 0, 1); return a + (y - Math.floor(y)) * (Date.UTC(Math.floor(y) + 1, 0, 1) - a) }
const toYear = (ms: number) => { const y = new Date(ms).getUTCFullYear(), a = Date.UTC(y, 0, 1); return y + (ms - a) / (Date.UTC(y + 1, 0, 1) - a) }
const dayIso = (y: number): IsoTime => new Date(Math.floor(YEAR_MS(y) / 864e5) * 864e5).toISOString().replace('.000Z', 'Z')

export const stepAt = (f: RecordedFuture, start: IsoTime): RecordedStep | null =>
  f.steps.find((s) => Date.parse(s.start) <= Date.parse(start) && Date.parse(start) < Date.parse(s.end)) ?? null
export const isSecondQuarter = (s: RecordedStep, start: IsoTime) => Date.parse(start) >= (Date.parse(s.start) + Date.parse(s.end)) / 2
/** The step before `s`'s 1-in-10 date (decimal year); step 1 starts from today's reading. */
const prevYear = (f: RecordedFuture, s: RecordedStep, today: IsoTime | null) => (s.step > 1 ? f.steps[s.step - 2].date10 : today ? toYear(Date.parse(today)) : s.date10)

/** The base timeline with frames after today replaced by this recorded future (2027Q1..2029Q4). */
export function simTimeline(base: Timeline, f: RecordedFuture, index: number, count: number): Timeline {
  const todayIdx = base.frames.findLastIndex((x) => x.provenance === 'real')
  const end = base.frames.findIndex((x) => x.quarter === LAST_QUARTER)
  const k = base.clock.minutesToMidnight && base.clock.secondsToMidnight ? base.clock.secondsToMidnight / base.clock.minutesToMidnight : 0
  const frames = base.frames.slice(0, end + 1).map((fr, i): WorldFrame => {
    const s = i > todayIdx ? stepAt(f, fr.start) : null
    if (!s) return fr
    const y = isSecondQuarter(s, fr.start) ? s.date10 : prevYear(f, s, base.clock.date10)
    const date10 = dayIso(y), minutes = Math.max(0, y - toYear(Date.parse(fr.start)))
    return {
      ...fr, provenance: 'simulated', pCat: s.anchors.cat2100, events: s.events, drivers: [], timeDays: 0, residualDays: 0,
      clock: { ...base.clock, date10, date10Range: [date10, date10], date10RangeBy: { lag: [date10, date10], market: [date10, date10] }, minutesToMidnight: minutes, secondsToMidnight: k ? k * minutes : null },
    }
  })
  const pcts = [0.05, 0.1, 0.25, 0.5, 0.9]
  const future: SampledFuture = { id: f.id, percentile: pcts[Math.round((index / Math.max(1, count - 1)) * 4)], asiDate: null, catDate: null }
  return { ...base, frames, future }
}

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
