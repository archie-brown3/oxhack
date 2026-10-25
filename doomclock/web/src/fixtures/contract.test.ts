// Contract drift test. `tsc --noEmit` checks each fixture against contracts.ts; this checks
// the fixtures against the real producer output in data/ (skipped for files not written yet).
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as fx from './index.ts'

const dataDir = new URL('../../../../data/', import.meta.url)
const pipelineDir = new URL('../../../pipeline/', import.meta.url)

// [fixture, path of the real file]. markets.json has no schema field (see contracts.ts).
const files: [string, object, URL][] = [
  ['markets', fx.markets, new URL('markets.json', pipelineDir)],
  ['state', fx.state, new URL('state.json', dataDir)],
  ['market-inputs', fx.marketInputs, new URL('market-inputs.json', dataDir)],
  ['signal-inputs', fx.signalInputs, new URL('signal-inputs.json', dataDir)],
  ['backtest', fx.backtest, new URL('backtest.json', dataDir)],
]

for (const [name, fixture, url] of files) {
  test(`${name}: real file has the fixture's schema and top-level keys`, (t) => {
    if (!existsSync(url)) return t.skip(`${url.pathname} not written yet`)
    const real = JSON.parse(readFileSync(url, 'utf8'))
    assert.equal(real.schema, (fixture as { schema?: string }).schema)
    assert.deepEqual(Object.keys(real).sort(), Object.keys(fixture).sort())
  })
}

test('every fixture survives a JSON round trip', () => {
  for (const [name, value] of Object.entries(fx)) {
    assert.deepEqual(JSON.parse(JSON.stringify(value)), value, name)
  }
})

test('state nodes are the four anchors, in sim order', () => {
  assert.deepEqual(
    fx.state.nodes.map((n) => n.id),
    ['asi2030', 'asi2040', 'asi2100', 'cat2100'],
  )
})

test('panel nudges stay clamped', () => {
  for (const p of fx.state.panel.personas)
    for (const n of Object.values(p.nudges)) assert.ok(Math.abs(n.dlogit) <= 0.5)
})
