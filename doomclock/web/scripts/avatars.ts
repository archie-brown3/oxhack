// Generates typographic avatars from avatars.accounts.json.
// Run: node scripts/avatars.ts   (from doomclock/web). Deterministic: same id -> same file.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

type Role = 'lab' | 'government' | 'media' | 'public' | 'researcher' | 'market'
type Account = { id: string; name: string; role: Role; provenance: 'real' | 'simulated'; mono?: string; aliases?: string[] }

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const out = here('../public/avatars/')
const tokens = JSON.parse(readFileSync(here('../../../context/design-system/tokens.json'), 'utf8'))
const tok = (name: string, theme: 'stage' | 'paper') =>
  tokens.color.tokens.find((t: { name: string }) => t.name === name).value[theme] as string

// Avatars carry their own dark tile, so they read on both Stage and Paper.
const INK = tok('ink', 'stage')
const INK2 = tok('ink-2', 'stage')
const SIM = tok('sim', 'stage')
const TILES = ['#161616', '#1f1f1f', '#2a2a2a'] // raised and two steps up; all >= 3:1 against ink

// Role glyphs, drawn around (48,74) in a 16px box. Typographic geometry, no icon set.
const GLYPH: Record<Role, string> = {
  lab: '<path d="M48 66L56 74L48 82L40 74Z" fill="none"/>',
  government: '<path d="M39 70L48 64L57 70ZM40 74H56M42 76V82M48 76V82M54 76V82" fill="none"/>',
  media: '<path d="M38 67H58M38 74H58M38 81H50" fill="none"/>',
  public: '<circle cx="48" cy="69" r="4" fill="none"/><path d="M40 82A8 8 0 0 1 56 82" fill="none"/>',
  researcher: '<circle cx="46" cy="72" r="6" fill="none"/><path d="M51 77L57 83" fill="none"/>',
  market: '<path d="M40 76H44V82H40ZM46 72H50V82H46ZM52 67H56V82H52Z" stroke-width="1"/>',
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const STOP = new Set(['the', 'of', 'and'])
const monogram = (a: Account) => {
  if (a.mono) return a.mono
  const w = a.name.split(/[\s.]+/).filter((x) => x && !STOP.has(x.toLowerCase()))
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).replace(/^./, (c) => c.toUpperCase())
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 3 - 1), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

function svg(a: Account) {
  const tile = TILES[hash(a.id) % TILES.length]
  const ring = a.provenance === 'real' ? `stroke="${INK}"` : `stroke="${SIM}" stroke-dasharray="6 4"`
  const m = monogram(a)
  const worst = Math.min(contrast(INK, tile), contrast(INK2, tile), contrast(a.provenance === 'real' ? INK : SIM, tile))
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="${esc(a.name)}">` +
    `<title>${esc(a.name)} (${a.provenance})</title>` +
    `<rect width="96" height="96" rx="3" fill="${tile}"/>` +
    `<rect x="3" y="3" width="90" height="90" rx="1" fill="none" stroke-width="2" ${ring}/>` +
    `<text x="48" y="56" text-anchor="middle" font-family="-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif" font-weight="700" font-size="${m.length > 1 ? 32 : 38}" fill="${INK}">${esc(m)}</text>` +
    `<g stroke="${INK2}" stroke-width="1.8" stroke-linecap="square" fill="${INK2}">${GLYPH[a.role]}</g></svg>\n`
  return { body, worst }
}

const accounts: Account[] = JSON.parse(readFileSync(here('./avatars.accounts.json'), 'utf8')).accounts
mkdirSync(out, { recursive: true })
const seen = new Set<string>()
const manifest: { id: string; name: string; role: string; provenance: string; file: string }[] = []
let low = 0
for (const a of accounts) {
  if (seen.has(a.id)) throw new Error(`duplicate id ${a.id}`)
  if (!GLYPH[a.role]) throw new Error(`unknown role ${a.role} for ${a.id}`)
  seen.add(a.id)
  const { body, worst } = svg(a)
  if (worst < 3) { low++; console.error(`contrast ${worst.toFixed(2)} < 3 for ${a.id}`) }
  writeFileSync(`${out}${a.id}.svg`, body)
  manifest.push({ id: a.id, name: a.name, role: a.role, provenance: a.provenance, file: `${a.id}.svg`, ...(a.aliases && { aliases: a.aliases }) })
}
writeFileSync(`${out}manifest.json`, JSON.stringify(manifest, null, 1) + '\n')

// Contact sheet: every avatar on Stage and Paper grounds.
const cell = (m: (typeof manifest)[number]) =>
  `<figure><img src="${m.file}" width="72" height="72" alt=""><figcaption>${esc(m.name)}<small>${m.role} · ${m.provenance}</small></figcaption></figure>`
const panel = (theme: 'stage' | 'paper') =>
  `<section style="background:${tok('ground', theme)};color:${tok('ink', theme)}"><h2 style="color:${tok('ink-2', theme)}">${theme}</h2><div>${manifest.map(cell).join('')}</div></section>`
writeFileSync(`${out}contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Avatars</title><style>
body{margin:0;font:12px -apple-system,'Helvetica Neue',sans-serif}section{padding:16px}h2{font:600 12px sans-serif;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px}
section>div{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:16px 8px}figure{margin:0;display:flex;flex-direction:column;gap:6px}figcaption small{display:block;opacity:.65}</style>
${panel('stage')}${panel('paper')}`)

console.log(`${manifest.length} avatars -> ${out}${low ? ` (${low} below 3:1)` : ' (all glyph/ring contrast >= 3:1)'}`)
if (low) process.exit(1)
