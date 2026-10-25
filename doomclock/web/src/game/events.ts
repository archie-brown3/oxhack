// The projected world-event roll for one turn (task 125, plan §6). Pure: (state, turn, rng) -> events.
// Market hazards play G1 or G5 for free, a lab may announce automated AI research, background
// incidents arrive at the AIID rate, and the calendar adds its dated items. All PROJECTED.
import hazardsRaw from './data/hazards.json' with { type: 'json' }
import ratesRaw from './data/incident-rates.json' with { type: 'json' }
import eventsRaw from './data/events.json' with { type: 'json' }
import { TURN_START } from './rules.ts'
import { guardianCard } from './cards.ts'
import type { GameState, GuardianCardId, WorldEvent } from './types.ts'

interface Hazard { id: string; card: string | null; series: string; question: string; perTurn: number[] }
export const HAZARDS = (hazardsRaw as { hazards: Hazard[] }).hazards
export const LAMBDA = (ratesRaw as { perQuarter: number }).perQuarter
export const EVENTS = eventsRaw as {
  background: { aiid: string; ts: string; text: string }[]
  surfacing: Record<string, { aiid: string; author: number; text: string }>
  noticeTemplate: string
  rsi: { author: number; market: string; text: string }
  calendar: { turn: number; date: string; author: number; source: string; text: string }[]
}

/** A date inside turn t's quarter. */
export function dateIn(turn: number, u: number): string {
  const start = Date.parse(TURN_START[turn - 1])
  const end = turn < TURN_START.length ? Date.parse(TURN_START[turn]) : start + 91 * 864e5
  return new Date(start + Math.floor(u * ((end - start) / 864e5)) * 864e5).toISOString().slice(0, 10)
}

export function poisson(lambda: number, rand: () => number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rand()
  } while (p > L)
  return k - 1
}

/** Has the world or the Guardian already put this measure in force? Then its hazard stops. */
const enacted = (s: GameState, card: GuardianCardId) => s.played.includes(card)

export function rollEvents(s: GameState, turn: number, rand: () => number): WorldEvent[] {
  const out: WorldEvent[] = []
  // Draw every uniform every turn, in a fixed order, so one event's outcome never shifts another's luck.
  const u = { hz: HAZARDS.map(() => rand()), pick: [rand(), rand(), rand(), rand()] }
  HAZARDS.forEach((h, i) => {
    const p = h.perTurn[turn - 1] ?? 0
    if (u.hz[i] >= p) return
    if (h.card) {
      if (enacted(s, h.card as GuardianCardId)) return
      out.push({ kind: 'hazard', label: 'PROJECTED', turn, date: dateIn(turn, u.pick[0]), card: h.card as GuardianCardId, source: `kalshi:${h.series}`, text: `PROJECTED · market ${h.series}. The world enacts the ${guardianCard(h.card as GuardianCardId).title.toLowerCase()} this quarter, without you.` })
    } else if (!s.log.some((l) => l.events.some((e) => e.kind === 'rsi'))) {
      out.push({ kind: 'rsi', label: 'PROJECTED', turn, date: dateIn(turn, u.pick[1]), source: `kalshi:${h.series}`, text: EVENTS.rsi.text, author: EVENTS.rsi.author })
    }
  })
  const count = poisson(LAMBDA, rand) // last: its draws vary
  const bg = EVENTS.background
  const a = Math.floor(u.pick[2] * bg.length)
  const b = (a + 1 + Math.floor(u.pick[3] * (bg.length - 1))) % bg.length
  out.push({ kind: 'incidents', label: 'PROJECTED', turn, date: dateIn(turn, 0.5), count, source: 'AIID rate', text: `PROJECTED · ${count} AI incidents reported this quarter, at the Apr-Sep 2026 AIID rate of ${LAMBDA} a quarter.` })
  for (const [k, i] of [a, b].entries()) {
    out.push({ kind: 'incidents', label: 'PROJECTED', turn, date: dateIn(turn, (k + 1) / 3), source: `AIID #${bg[i].aiid}`, text: `PROJECTED · modelled on AIID #${bg[i].aiid}. ${bg[i].text}`, author: k === 0 ? 24 : 25 })
  }
  for (const c of EVENTS.calendar.filter((c) => c.turn === turn)) {
    out.push({ kind: 'calendar', label: 'PROJECTED', turn, date: c.date, source: c.source, text: c.text, author: c.author })
  }
  return out
}
