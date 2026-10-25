// Build check (task 156): the production bundle is inert. It must not name the MiroFish backend or any of its
// routes (/api/simulation, /api/report, /api/graph): live mode only ever asks this origin for /live, which the
// dev and preview servers proxy and Vercel answers 404. Runs at the end of `npm run build`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
// The replica shows MiroFish's route names as captions, so the check is for the backend host and absolute URLs to it.
const BAD = [/localhost:5001/, /127\.0\.0\.1:5001/, /:5001\b/, /https?:\/\/[^"'`\s]*\/api\/(simulation|report|graph)/]
const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|html|css)$/.test(f)) files.push(p) } }
walk(dist)
const hits = []
for (const f of files) { const s = readFileSync(f, 'utf8'); for (const re of BAD) { const m = s.match(re); if (m) hits.push(`${f.slice(dist.length)}: ${m[0]}`) } }
if (hits.length) { console.error(`check-inert: the production bundle names the MiroFish backend:\n  ${hits.join('\n  ')}`); process.exit(1) }
console.log(`check-inert: ${files.length} built files name no MiroFish endpoint`)
