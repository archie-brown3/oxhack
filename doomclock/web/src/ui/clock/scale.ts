// The clock's scale (owner, 25 Oct): today's reading is pinned to the Bulletin's current setting
// (85 s), and k = 85 s ÷ the years from today to date10 fixes "seconds per year" for every other
// reading. Past quarters show the Bulletin's own setting as real history; from today the market
// forecast drives the hand. The face shows the last 3 minutes across its quarter.
import type { ClockReading, IsoTime, Timeline, WorldFrame } from '../../contracts.ts'

export interface BulletinSetting { ts: IsoTime; seconds_to_midnight: number; url: string; reason: string }
export const FACE_SECONDS = 180
const YEAR = 365.25 * 864e5

/** The setting in force at `t` (the latest with ts < t). */
export const bulletinAt = (b: BulletinSetting[], t: number) => b.filter((x) => Date.parse(x.ts) < t).at(-1) ?? null

export interface Hand {
  seconds: number
  source: 'bulletin' | 'forecast' | 'simulated'
  /** Simulated frames: today's reading, drawn as a ghost hand. */
  ghost?: number
  /** Seconds the 1-in-10 date range spans at this scale, for the grey band. */
  range: [number, number] | null
  setting: BulletinSetting | null
}

export function scaleOf(timeline: Timeline, bulletin: BulletinSetting[]) {
  const now = Date.parse(timeline.asOf)
  const today = bulletinAt(bulletin, now)
  const pin = today?.seconds_to_midnight ?? 85
  const years = timeline.clock.minutesToMidnight // 1 min = 1 year in the engine's reading
  const k = years && years > 0 ? pin / years : 0 // seconds per year of lead time
  const sec = (date: IsoTime | null, at: number) => (date ? Math.max(0, ((Date.parse(date) - at) / YEAR) * k) : FACE_SECONDS)
  const rangeAt = (r: ClockReading, at: number): [number, number] => [sec(r.date10Range[0], at), sec(r.date10Range[1], at)]
  return {
    k,
    pin,
    /** The hand for a frame: the Bulletin's setting up to today, today pinned, the forecast after. */
    hand(frame: WorldFrame, isToday: boolean): Hand {
      const start = Date.parse(frame.start)
      if (frame.provenance === 'simulated') return { seconds: frame.clock?.minutesToMidnight == null ? FACE_SECONDS : k * frame.clock.minutesToMidnight, source: 'simulated', range: null, ghost: pin, setting: today }
      if (isToday) return { seconds: pin, source: 'bulletin', range: rangeAt(timeline.clock, now), setting: today }
      if (start < now) {
        const s = bulletinAt(bulletin, start + 92 * 864e5) // the setting in force by the end of the quarter
        return { seconds: s?.seconds_to_midnight ?? pin, source: 'bulletin', range: null, setting: s }
      }
      return { seconds: sec(timeline.clock.date10, start), source: 'forecast', range: rangeAt(timeline.clock, start), setting: today }
    },
    /** Days of real time per second on the face. */
    daysPerSecond: k > 0 ? 365.25 / k : null,
  }
}

/** How close the hand is to midnight on the face, 0 (a full face away) to 1 (midnight). */
export const closeness = (h: Hand) => Math.max(0, Math.min(1, 1 - h.seconds / FACE_SECONDS))
