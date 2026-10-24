// Copies the pipeline's data/*.json into public/cache/ so the built app can load them offline.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dataDir = fileURLToPath(new URL('../../../data/', import.meta.url))
const cacheDir = fileURLToPath(new URL('../public/cache/', import.meta.url))

mkdirSync(cacheDir, { recursive: true })
const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'))
for (const f of files) copyFileSync(dataDir + f, cacheDir + f)
console.log(`publish:cache copied ${files.length} file(s): ${files.join(', ') || '(none)'}`)
