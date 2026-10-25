// Scoring maths for the backtest: Brier, a clustered bootstrap CI, reliability bins and the w pick.
// Pure functions, no I/O. Tested in score.test.ts on hand-made fixtures.

/** Mean squared error of probabilities `p` against 0/1 outcomes `y`. Lower is better; a 50% coin scores 0.25. */
export function brier(p: number[], y: number[]): number {
  if (p.length !== y.length || !p.length) throw new Error("brier: need equal, non-empty arrays");
  let s = 0;
  for (let i = 0; i < p.length; i++) s += (p[i] - y[i]) ** 2;
  return s / p.length;
}

/** Mulberry32: a small seeded RNG, so every CI is reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};

/**
 * 95% bootstrap CI of a statistic over rows, resampling whole clusters (one Polymarket event or
 * Kalshi strike ladder is one cluster), because questions in one event share an outcome driver.
 * `stat` gets the row indices of one resample.
 */
export function bootstrapCI(groups: string[], stat: (idx: number[]) => number, reps = 2000, seed = 1): [number, number] {
  const byGroup = new Map<string, number[]>();
  groups.forEach((g, i) => { const a = byGroup.get(g); if (a) a.push(i); else byGroup.set(g, [i]); });
  const clusters = [...byGroup.values()];
  const r = rng(seed), out: number[] = [];
  for (let k = 0; k < reps; k++) {
    const idx: number[] = [];
    for (let j = 0; j < clusters.length; j++) idx.push(...clusters[Math.floor(r() * clusters.length)]);
    out.push(stat(idx));
  }
  return [quantile(out, 0.025), quantile(out, 0.975)];
}

export type Bin = { lo: number; hi: number; n: number; meanForecast: number; observed: number };

/** Ten equal-width bins on [0, 1]; empty bins are left out. p = 1 goes in the top bin. */
export function reliability(p: number[], y: number[], bins = 10): Bin[] {
  const out: Bin[] = [];
  for (let b = 0; b < bins; b++) {
    const lo = b / bins, hi = (b + 1) / bins;
    const idx = p.flatMap((v, i) => (v >= lo && (v < hi || (b === bins - 1 && v <= hi)) ? [i] : []));
    if (!idx.length) continue;
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    out.push({ lo, hi, n: idx.length, meanForecast: mean(idx.map((i) => p[i])), observed: mean(idx.map((i) => y[i])) });
  }
  return out;
}

/** blend = market + w·(llm − market), clamped to [0, 1]. */
export const blend = (market: number, llm: number, w: number) => Math.min(1, Math.max(0, market + w * (llm - market)));

/** The w on `grid` with the lowest Brier on the rows given (the training half only). Ties go to the smaller w. */
export function pickW(market: number[], llm: number[], y: number[], grid: number[]) {
  const scores = grid.map((w) => ({ w, brier: brier(market.map((m, i) => blend(m, llm[i], w)), y) }));
  const best = scores.reduce((a, b) => (b.brier < a.brier - 1e-12 ? b : a));
  return { w: best.w, scores };
}

/**
 * Split rows by date at the median forecast date `t`. Test rows were forecast on or after the cut.
 * Train rows must also have RESOLVED before the cut, so everything fitted on train (base rate, w)
 * was knowable when the first test forecast was made. Rows forecast before the cut but resolved
 * after it fall in the gap and are used by neither half.
 */
export function splitByDate<T extends { t: number; resolved: number }>(rows: T[]): { train: T[]; test: T[]; gap: number; cut: number } {
  const ts = rows.map((r) => r.t).sort((a, b) => a - b);
  const cut = ts[Math.floor(ts.length / 2)];
  const train = rows.filter((r) => r.resolved < cut), test = rows.filter((r) => r.t >= cut);
  return { train, test, gap: rows.length - train.length - test.length, cut };
}
