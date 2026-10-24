// Fan band for the real line (E7, D21). It is a model assumption, not a forecast: it spans the
// lag mean, the one sim input no market backs, over a log-uniform prior [L / f, L * f].
// With one seed (common random numbers) every path's catastrophe time grows with the lag, so
// each year's cumulative P falls as the lag grows. The p10/p50/p90 of P across the prior are
// therefore the curves at the prior's 90th/50th/10th percentile lags: three runs, not hundreds.
import { sim } from "./sim.ts";
import type { FanPoint, SimInput, SimOptions } from "./sim.ts";

export function fanBand(
  input: SimInput,
  { lagFactor = 3, ...opts }: SimOptions & { lagFactor?: number } = {},
): FanPoint[] {
  const L = input.lagMeanYears;
  const run = (q: number) => sim({ ...input, lagMeanYears: L * lagFactor ** (2 * q - 1) }, opts).fan;
  const lo = run(0.9); // long lags -> low P
  const mid = run(0.5);
  const hi = run(0.1);
  return mid.map(({ year, p }, i) => ({ year, p, p10: lo[i].p, p50: p, p90: hi[i].p }));
}
