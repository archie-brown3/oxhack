// Small shared formatters and constants for the UI. Dates are shown in UTC, en-GB.
import type { IsoTime, QuarterLabel } from '../contracts.ts'

const opts = (o: Intl.DateTimeFormatOptions) => ({ ...o, timeZone: 'UTC' })
export const dmy = (t: IsoTime) => new Date(t).toLocaleDateString('en-GB', opts({ day: 'numeric', month: 'short', year: 'numeric' }))
export const monthYear = (t: IsoTime) => new Date(t).toLocaleDateString('en-GB', opts({ month: 'short', year: 'numeric' }))
export const longDate = (t: IsoTime) => new Date(t).toLocaleDateString('en-GB', opts({ day: 'numeric', month: 'long', year: 'numeric' }))
export const qName = (q: QuarterLabel) => `${q.slice(4)} ${q.slice(0, 4)}`
export const fmt = (n: number) => n.toLocaleString('en-GB')
export const pct = (p: number) => `${Math.round(p * 100)}%`

/** Source ids from data/events.json, as people say them. */
export const SOURCE: Record<string, string> = {
  aiid: 'AI Incident Database',
  'federal-register': 'Federal Register',
  'gov.uk': 'GOV.UK',
  'eur-lex': 'EUR-Lex',
  wikipedia: 'Wikipedia',
  bulletin: 'Bulletin of the Atomic Scientists',
  engine: 'Engine projection',
  mirofish: 'MiroFish',
}
export const sourceName = (s: string) => SOURCE[s] ?? s

/** "y d hh:mm:ss" from now to `target`. */
export function countdown(target: IsoTime, now = new Date()): string {
  const t = new Date(target)
  const at = (k: number) => new Date(Date.UTC(now.getUTCFullYear() + k, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()))
  let y = 0
  while (at(y + 1) <= t) y++
  let s = Math.max(0, Math.floor((+t - +at(y)) / 1000))
  const days = Math.floor(s / 86400)
  s %= 86400
  const p = (n: number) => String(n).padStart(2, '0')
  return `${y}y ${String(days).padStart(3, '0')}d ${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
