// Severity drives legibility. Simulated events carry `severity`; real ones are major when flagged
// `major`, else moderate (events.json has no AIID report count yet, so none is minor).
import type { WorldEvent } from '../../contracts.ts'

export type Severity = 'major' | 'moderate' | 'minor'
export const severityOf = (e: WorldEvent): Severity => e.severity ?? (e.major ? 'major' : 'moderate')
export const RANK: Record<Severity, number> = { major: 0, moderate: 1, minor: 2 }

/** Majors first, then moderate, then minor; newest first within each. */
export const bySeverity = (a: WorldEvent, b: WorldEvent) => RANK[severityOf(a)] - RANK[severityOf(b)] || Date.parse(b.ts) - Date.parse(a.ts)

/** A 4-6 word label for the globe: drops an "Incident SIM-2027-1:" style prefix, keeps the first 5 words. */
export function shortLabel(title: string): string {
  const w = title.replace(/^Incident SIM-[\d-]+:\s*/i, '').replace(/^Projected incident, like:\s*/i, '').split(/\s+/)
  return w.slice(0, 5).join(' ') + (w.length > 5 ? '…' : '')
}
export const MAX_MAJOR_TITLES = 3
