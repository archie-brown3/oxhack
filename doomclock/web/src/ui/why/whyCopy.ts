// The When sheet quotes the measured track record. The shape-only fixture is never a result.
import type { BacktestFile } from '../../contracts.ts'

export interface MeasuredScore { brier: string; coin: string; minTraders: number }

export function measuredScore(bt: BacktestFile | null): MeasuredScore | null {
  if (!bt || bt.leakage.canary.note === 'Fixture.') return null
  return {
    brier: bt.scores.test.market.brier.toFixed(3),
    coin: bt.scores.test.coin.brier.toFixed(3),
    minTraders: bt.design.minTradersManifold,
  }
}
