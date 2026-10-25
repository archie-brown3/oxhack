// Copies the pipeline's data/*.json into public/cache/ so the built app can load them offline.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dataDir = fileURLToPath(new URL('../../../data/', import.meta.url))
const cacheDir = fileURLToPath(new URL('../public/cache/', import.meta.url))

mkdirSync(cacheDir, { recursive: true })
const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'))
for (const f of files) copyFileSync(dataDir + f, cacheDir + f)
console.log(`publish:cache copied ${files.length} file(s): ${files.join(', ') || '(none)'}`)

// Datacentres (Epoch AI's frontier sites, clean JSONL) as one JSON array for the globe.
// ponytail: swap in datacentres-public.jsonl here when it lands (label: publicly mapped sites, not compute share).
const dcLines = readFileSync(fileURLToPath(new URL('../../../data/clean/datacentres.jsonl', import.meta.url)), 'utf8').trim().split('\n')
writeFileSync(cacheDir + 'datacentres.json', JSON.stringify(dcLines.map((l) => JSON.parse(l))))
console.log(`publish:cache wrote datacentres.json (${dcLines.length} sites)`)

// The Bulletin's Doomsday Clock settings: the clock's real history, and today's calibration (85 s).
const bulletin = readFileSync(fileURLToPath(new URL('../../../data/clean/doomsday_clock.jsonl', import.meta.url)), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
writeFileSync(cacheDir + 'bulletin.json', JSON.stringify(bulletin))
console.log(`publish:cache wrote bulletin.json (${bulletin.length} settings)`)

// The engine's one input (engine/world.ts), straight from asOf(T) (pipeline/asof): T is the data freeze, the
// asOf of data/state.json, or --asOf=ISO. Prices, history, curve and events can't drift from T. ui loads cache/world.json.
const { worldFrom } = await import('../src/engine/world.ts')
// A computed specifier, so tsc -b doesn't type-check the pipeline (plain node ESM outside this package).
const { asOf } = await import(new URL('../../pipeline/asof/asof.ts', import.meta.url).href)
const read = (f: string) => JSON.parse(readFileSync(dataDir + f, 'utf8'))
const at = asOf(process.argv.find((a) => a.startsWith('--asOf='))?.slice(7) ?? read('state.json').asOf)
const marketInputs = at.marketInputs()
if (!marketInputs) throw new Error(`publish:cache: no KXAGICO curve before ${at.T}`)
const markets = JSON.parse(readFileSync(fileURLToPath(new URL('../../pipeline/markets.json', import.meta.url)), 'utf8'))
const world = worldFrom({
  state: at.state(), marketInputs, signalInputs: read('signal-inputs.json'), events: at.eventsFile(), markets,
  bulletin: at.records('doomsday_clock') as unknown as BulletinRow[],
})
writeFileSync(cacheDir + 'world.json', JSON.stringify(world))
console.log(`publish:cache wrote world.json from asOf(${at.T}): ${world.events.length} events, ${world.events.filter((e) => e.major).length} major`)
type BulletinRow = { ts: string; seconds_to_midnight: number }
