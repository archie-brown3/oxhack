import type { SimResult } from '../contracts.ts'

export const simResult: SimResult = {
  schema: 'doomclock.sim/1',
  pCat2100: 0.3,
  medianCatDate: '2061-03-14T00:00:00Z',
  p10Year: 2049,
  fan: [
    { year: 2030, p: 0.01, p10: 0.005, p50: 0.01, p90: 0.02 },
    { year: 2050, p: 0.12 },
    { year: 2100, p: 0.3, p10: 0.28, p50: 0.3, p90: 0.32 },
  ],
  scenarioMix: { noAsiBy2100: 0.14, asiFine: 0.56, fastCatastrophe: 0.06, slowCatastrophe: 0.24 },
  ms: 12,
}
