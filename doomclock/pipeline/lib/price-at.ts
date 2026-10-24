// Point-in-time price lookup over the clean market files (kind=price rows of data/clean/<source>.jsonl).
// priceAt(series, T) is the last price strictly before T, carried forward: the CLAUDE.md `ts < T` rule.
// Public API, shared by state/build-state.ts and the backtest. Semantics: docs/data/state.md.
// Times are compared as numbers, never strings: "…00Z" and "…00.000Z" are the same instant.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Point = { t: number; p: number };

const CLEAN = join(import.meta.dirname, "../../../data/clean");

/** Price rows keyed by record id ("manifold:<id>", "kalshi:<ticker>", "pm:<id>"), each sorted by t (epoch ms). */
export function loadPrices(source: "manifold" | "kalshi" | "polymarket"): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  for (const line of readFileSync(join(CLEAN, `${source}.jsonl`), "utf8").split("\n")) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (r.kind !== "price") continue;
    let s = out.get(r.id);
    if (!s) out.set(r.id, (s = []));
    s.push({ t: Date.parse(r.ts), p: r.p });
  }
  for (const s of out.values()) s.sort((a, b) => a.t - b.t);
  return out;
}

/** The last point with t < T (a row exactly at T is excluded), or null when none is. `series` must be sorted by t. */
export function priceAt(series: Point[], T: string): { p: number; ts: string } | null {
  const tT = Date.parse(T);
  if (Number.isNaN(tT)) throw new Error(`priceAt: bad T ${T}`);
  let lo = 0, hi = series.length; // binary search: lo ends at the first index with t >= T
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t < tT) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return null;
  const { t, p } = series[lo - 1];
  // ISO to the second, rounded up like the clean files, so ts is never earlier than the price was public.
  return { p, ts: new Date(Math.ceil(t / 1000) * 1000).toISOString().replace(".000Z", "Z") };
}
