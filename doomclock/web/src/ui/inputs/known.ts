// What the engine knows at T: every real input dated strictly before T (point-in-time, ts < T).
// Pure, so the Inputs sheet and its test read the same filter.
import type { NodeId, World, WorldEvent } from '../../contracts.ts'

export const NODES: NodeId[] = ['asi2030', 'asi2040', 'asi2100', 'cat2100']
export interface DatedSite { ts: string }

export function knownAt<D extends DatedSite>(world: World, dcs: D[], T: number) {
  const ev = (k: WorldEvent['kind']) => world.events.filter((e) => e.kind === k && e.provenance === 'real' && Date.parse(e.ts) < T).reverse()
  const prices = Object.fromEntries(NODES.map((id) => [id, world.anchorHistory[id].history.filter((p) => Date.parse(p.ts ?? p.T) < T)])) as Record<NodeId, World['anchorHistory'][NodeId]['history']>
  const known = {
    incident: ev('incident'), government: ev('government'), news: ev('news'),
    datacentres: dcs.filter((d) => Date.parse(d.ts) < T).sort((a, b) => b.ts.localeCompare(a.ts)),
    prices,
  }
  const total = world.events.filter((e) => e.provenance === 'real').length + dcs.length + NODES.reduce((n, id) => n + world.anchorHistory[id].history.length, 0)
  const seen = known.incident.length + known.government.length + known.news.length + known.datacentres.length + NODES.reduce((n, id) => n + prices[id].length, 0)
  return { ...known, total, seen, hidden: total - seen }
}
