// Runtime data. The World input comes from public/cache/world.json once the asOf(T) module writes
// it; until then, the engine's frozen fixture (real data, frozen 24 Oct). Everything else is
// public/cache (npm run publish:cache) plus the Natural Earth countries. Works offline.
import worldFixture from '../engine/fixtures/world.fixture.json?raw'
import type { World } from '../contracts.ts'
import type { BulletinSetting } from '../ui/clock/scale.ts'
import type { Avatar } from '../ui/engine/EngineScreen.tsx'

export interface Datacentre { ts: string; id: string; name: string; operator: string; lat: number; lon: number; country: string; status: string; power_mw?: number; url: string }
export interface Country { properties: { ADM0_A3: string; NAME: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } }
export interface Countries { features: Country[] }
export interface Data { avatars: Avatar[]; world: World; worldSource: 'cache' | 'fixture'; dcs: Datacentre[]; bulletin: BulletinSetting[]; countries: Countries; centroids: Map<string, [number, number]> }

const get = async <T,>(path: string): Promise<T | null> => {
  try { const r = await fetch(path); return r.ok ? ((await r.json()) as T) : null } catch { return null }
}

export async function load(): Promise<Data> {
  const [cached, dcs, bulletin, countries, avatars] = await Promise.all([
    get<World>('cache/world.json'), get<Datacentre[]>('cache/datacentres.json'), get<BulletinSetting[]>('cache/bulletin.json'), get<Countries>('ne_110m_countries.geojson'), get<Avatar[]>('avatars/manifest.json'),
  ])
  if (!countries) throw new Error('ne_110m_countries.geojson missing from public/')
  const world = cached ?? (JSON.parse(worldFixture) as World)
  return { avatars: avatars ?? [], world, worldSource: cached ? 'cache' : 'fixture', dcs: dcs ?? [], bulletin: bulletin ?? [], countries, centroids: centroids(countries) }
}

// A country's label point: the centre of its largest ring's bounding box.
function centroids(c: Countries) {
  const out = new Map<string, [number, number]>()
  for (const f of c.features) {
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][]
    const ring = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0]
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
    out.set(f.properties.ADM0_A3, [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2])
  }
  return out
}

const inRing = (x: number, y: number, ring: number[][]) => {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
export const countryName = (c: Countries, iso: string | undefined) => c.features.find((f) => f.properties.ADM0_A3 === iso)?.properties.NAME
export const countryAt = (c: Countries, lat: number, lng: number) =>
  c.features.find((f) => ((f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][]).some((p) => inRing(lng, lat, p[0])))?.properties.NAME
