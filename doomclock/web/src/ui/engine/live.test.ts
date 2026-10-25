// Live mode (task 156) is local only, and the browser never names a MiroFish endpoint: the live client talks
// to /live on its own origin, which only the dev and preview servers forward. check-inert.mjs checks the bundle.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { liveMode, liveRound } from './live.ts'

test('liveMode: on with ?live on localhost only', () => {
  assert.equal(liveMode(new URL('http://localhost:5173/?view=engine&live=1')), 'run')
  assert.equal(liveMode(new URL('http://127.0.0.1:4173/?live=report')), 'report')
  assert.equal(liveMode(new URL('http://localhost:5173/?live=0')), null)
  assert.equal(liveMode(new URL('http://localhost:5173/?view=engine')), null)
  assert.equal(liveMode(new URL('https://oxhack.vercel.app/?view=engine&live=1')), null)
  assert.equal(liveMode(new URL('https://doomclock.example/?live=report')), null)
})

test('liveRound: arrived actions while running, every round once finished', () => {
  const step = (runner_status: string, total_rounds: number, rounds: number[]) => ({ runStatus: { runner_status, total_rounds }, actions: rounds.map((round_num) => ({ round_num })) }) as any
  assert.equal(liveRound(step('running', 5, [0, 0, 1]), 'running'), 2)
  assert.equal(liveRound(step('running', 5, []), 'running'), 0)
  assert.equal(liveRound(step('completed', 5, [0, 1, 2, 3, 4]), 'running'), 5)
  assert.equal(liveRound(step('running', 5, [0, 1]), 'done'), 5)
})

test('every fetch in the web source targets this origin: cache/ files or /live', () => {
  // The replica shows MiroFish's route names as captions (a 1:1 copy of its UI), so the proof is about what
  // the browser asks for, not which strings it holds: no backend host, and every fetch target is relative.
  const src = new URL('../../', import.meta.url).pathname
  const files: string[] = []
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts')) files.push(p) } }
  walk(src)
  const targets: string[] = []
  for (const f of files) {
    const code = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(code, /localhost:5001|127\.0\.0\.1:5001|:5001\b/, `${f.slice(src.length)} names the MiroFish backend`)
    for (const m of code.matchAll(/\bfetch\(\s*([^,)]+)/g)) targets.push(`${f.slice(src.length)}: ${m[1].trim()}`)
  }
  const ok = /: ('|`)(cache\/|\/live\/)|: path$|: mode === 'run' \? '\/live\/state' : '\/live\/report'$/
  assert.deepEqual(targets.filter((t) => !ok.test(t)), [], 'a fetch target that is not a relative cache/ or /live path')
  // `path` callers: load.ts (cache/replica/...), futures.ts and data.ts (cache/...), all relative.
  assert.ok(targets.length >= 4)
})
