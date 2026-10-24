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

// The engine's one input, built from the files above (engine/world.ts). ui loads cache/world.json.
const { worldFrom } = await import('../src/engine/world.ts')
const read = (f: string) => JSON.parse(readFileSync(dataDir + f, 'utf8'))
const markets = JSON.parse(readFileSync(fileURLToPath(new URL('../../pipeline/markets.json', import.meta.url)), 'utf8'))
const world = worldFrom({
  state: read('state.json'), marketInputs: read('market-inputs.json'), signalInputs: read('signal-inputs.json'),
  events: read('events.json'), markets, bulletin,
})
writeFileSync(cacheDir + 'world.json', JSON.stringify(world))
console.log(`publish:cache wrote world.json (asOf ${world.asOf}, ${world.events.length} events)`)
