// Severity drives legibility. Simulated events carry `severity`. Real ones: major when flagged
// `major` (10+ press reports, docs/data/events.md); an AIID incident with a single press report is
// minor (45% of them); the rest are moderate. The count is read from the detail sentence.
import type { WorldEvent } from '../../contracts.ts'

export type Severity = 'major' | 'moderate' | 'minor'
export const severityOf = (e: WorldEvent): Severity =>
  e.severity ?? (e.major ? 'major' : e.source === 'aiid' && /Covered in 1 press report\b/.test(e.detail ?? '') ? 'minor' : 'moderate')
export const RANK: Record<Severity, number> = { major: 0, moderate: 1, minor: 2 }

/** Majors first, then moderate, then minor; newest first within each. */
export const bySeverity = (a: WorldEvent, b: WorldEvent) => RANK[severityOf(a)] - RANK[severityOf(b)] || Date.parse(b.ts) - Date.parse(a.ts)

/** A 4-6 word label for the globe: drops an "Incident SIM-2027-1:" style prefix, keeps the first 5 words. */
export function shortLabel(title: string): string {
  const w = title.replace(/^Incident SIM-[\d-]+:\s*/i, '').replace(/^Projected incident, like:\s*/i, '').split(/\s+/)
  return w.slice(0, 5).join(' ') + (w.length > 5 ? '…' : '')
}
export const MAX_MAJOR_TITLES = 3
