import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { BacktestFile } from '../../contracts.ts'
import { backtest as fixture } from '../../fixtures/backtest.ts'
import { measuredScore } from './whyCopy.ts'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')) as BacktestFile

test('fixture scores are not quoted as the track record', () => {
  assert.equal(measuredScore(fixture), null)
  assert.equal(measuredScore(null), null)
})

test('the measured file supplies the Brier line and the trader minimum', () => {
  const bt = read('../../../public/cache/backtest.json')
  const s = measuredScore(bt)
  assert.ok(s)
  assert.equal(s.brier, '0.085')
  assert.equal(s.coin, '0.250')
  assert.equal(s.minTraders, 20)
  assert.equal(s.minTraders, bt.design.minTradersManifold)
})
