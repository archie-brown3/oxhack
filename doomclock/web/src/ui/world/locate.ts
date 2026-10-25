// Where an event sits on the map. Kept apart from Globe.tsx so the app can place events
// without pulling globe.gl (three.js) into the first chunk.
import type { WorldEvent } from '../../contracts.ts'

export interface Located extends WorldEvent { lat: number; lng: number }
export interface Flare { iso3: string[]; sim: boolean }

/** Where an event sits on the map: its `where` country, else its region's main country. */
export function locate(e: WorldEvent, centroids: Map<string, [number, number]>): Located | null {
  const iso = e.where ?? (e.region === 'US' ? 'USA' : e.region === 'China' ? 'CHN' : null)
  const c = iso && centroids.get(iso)
  if (!c) return null
  let h = 0
  for (const ch of e.title) h = (h * 31 + ch.charCodeAt(0)) | 0
  const j = e.where ? 0 : 1 // spread region-only events a little so they don't stack
  return { ...e, lat: c[0] + j * (((h & 255) / 255) * 8 - 4), lng: c[1] + j * ((((h >> 8) & 255) / 255) * 14 - 7) }
}
