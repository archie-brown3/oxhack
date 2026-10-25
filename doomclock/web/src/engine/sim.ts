// Monte Carlo of AI futures (engine spec §4). Pure: the same input and seed always give the
// same result, apart from `ms`. No dependencies; runs in the browser and under plain `node`.
import { mulberry32 } from "./rng.ts";

export const HORIZON = 2100;

export interface AsiPoint {
  year: number; // decimal year; "by 2030" is the caller's call (2030.0 or 2031.0)
  p: number; // P(ASI by year), conditional on no existential catastrophe
}

export interface SimInput {
  startYear: number; // "now" as a decimal year: the ASI CDF is 0 here
  asi: AsiPoint[]; // market points, years strictly increasing and after startYear
  pCat2100: number; // market: P(AI kills >= 10% of humans before 2100)
  lagMeanYears: number; // mean ASI -> catastrophe lag (exponential); a default, not market-backed
  pBad?: number; // override for P(goes wrong | ASI) (the Model drawer slider)
}

export interface SimOptions {
  seed?: number;
  paths?: number;
}

export interface FanPoint {
  year: number;
  p: number; // P(catastrophe by the end of `year`, i.e. time <= year)
  p10?: number;
  p50?: number;
  p90?: number;
}

export type Scenario = "noAsi" | "asiFine" | "fastCat" | "slowCat";

export interface SimResult {
  schema: "doomclock.sim/1";
  pCat2100: number;
  medianCatDate: string | null; // ISO; median catastrophe time among paths doomed by 2100
  p10Year: number | null; // first fan year where P(catastrophe) >= 10%
  fan: FanPoint[]; // one point per year, ceil(startYear)..2100
  scenarioMix: Record<Scenario, number>; // fractions summing to 1; fastCat + slowCat = pCat2100
  ms: number;
}

export interface AsiKnots {
  xs: number[]; // years, starting with startYear
  ps: number[]; // cumulative P, starting with 0, non-decreasing
  monotonised: boolean; // true if the market points disagreed and were pooled
}

// Validates the input and returns the piecewise-linear ASI CDF knots. Non-monotone market
// points (two markets disagreeing) are monotonised, not rejected, so a live refresh never
// kills the clock; the caller can surface `monotonised`. Malformed input throws.
export function asiKnots(input: SimInput): AsiKnots {
  const { startYear, asi, pCat2100, lagMeanYears, pBad } = input;
  if (!Number.isFinite(startYear)) throw new Error(`sim: bad startYear ${startYear}`);
  if (!(lagMeanYears >= 0 && Number.isFinite(lagMeanYears))) {
    throw new Error(`sim: bad lagMeanYears ${lagMeanYears}`);
  }
  if (!isProb(pCat2100)) throw new Error(`sim: bad pCat2100 ${pCat2100}`);
  if (pBad !== undefined && !isProb(pBad)) throw new Error(`sim: bad pBad ${pBad}`);
  let prev = startYear;
  for (const { year, p } of asi) {
    if (!(Number.isFinite(year) && year > prev)) {
      throw new Error(`sim: ASI years must be strictly increasing after startYear (${year})`);
    }
    if (!isProb(p)) throw new Error(`sim: bad ASI p ${p} at ${year}`);
    prev = year;
  }
  const raw = asi.map((a) => a.p);
  const ps = monotonise(raw);
  return {
    xs: [startYear, ...asi.map((a) => a.year)],
    ps: [0, ...ps],
    monotonised: ps.some((p, i) => p !== raw[i]),
  };
}

// Pool-adjacent-violators: the closest (least-squares) non-decreasing sequence.
export function monotonise(ps: number[]): number[] {
  const blocks: { sum: number; n: number }[] = [];
  for (const p of ps) {
    blocks.push({ sum: p, n: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.sum / a.n <= b.sum / b.n) break;
      a.sum += b.sum;
      a.n += b.n;
      blocks.pop();
    }
  }
  return blocks.flatMap((b) => Array<number>(b.n).fill(b.sum / b.n));
}

// CDF value at `year`; flat after the last knot.
export function cdfAt({ xs, ps }: AsiKnots, year: number): number {
  if (year <= xs[0]) return 0;
  for (let i = 1; i < xs.length; i++) {
    if (year <= xs[i]) return ps[i - 1] + ((ps[i] - ps[i - 1]) * (year - xs[i - 1])) / (xs[i] - xs[i - 1]);
  }
  return ps[ps.length - 1];
}

// Inverse CDF: uniform u -> ASI arrival year, or Infinity for "not by the last knot".
export function arrivalYear({ xs, ps }: AsiKnots, u: number): number {
  for (let i = 1; i < xs.length; i++) {
    if (u < ps[i]) return xs[i - 1] + ((u - ps[i - 1]) * (xs[i] - xs[i - 1])) / (ps[i] - ps[i - 1]);
  }
  return Infinity;
}

// p_bad = P(cat by 2100) / P(ASI by 2100), clamped to [0, 1]; 0 if ASI by 2100 is impossible.
export function pBadOf(input: SimInput, knots = asiKnots(input)): number {
  if (input.pBad !== undefined) return input.pBad;
  const pAsi = cdfAt(knots, HORIZON);
  return pAsi > 0 ? Math.min(1, input.pCat2100 / pAsi) : 0;
}

// Exact P(catastrophe by `year`) for the model: the continuous CDF the paths sample. On a CDF
// segment [a, b] cut at the year, with density d: d * integral of (1 - exp(-(year - t) / L)) dt.
export function analyticCdf(input: SimInput, year: number, knots = asiKnots(input)): number {
  const { xs, ps } = knots;
  const L = input.lagMeanYears;
  let mass = 0;
  for (let i = 1; i < xs.length && xs[i - 1] < year; i++) {
    const a = xs[i - 1];
    const b = Math.min(xs[i], year);
    const d = (ps[i] - ps[i - 1]) / (xs[i] - xs[i - 1]);
    const tail = L === 0 ? 0 : L * (Math.exp(-(year - b) / L) - Math.exp(-(year - a) / L));
    mass += d * (b - a - tail);
  }
  return pBadOf(input, knots) * mass;
}

// Exact P(catastrophe by 2100), for tests and sanity checks.
export function analyticPCat2100(input: SimInput): number {
  return analyticCdf(input, HORIZON);
}

// Each path's dates, for picking one future. Infinity means "not by 2100".
export interface Paths {
  asi: Float64Array;
  cat: Float64Array;
}

export function sim(input: SimInput, opts: SimOptions = {}): SimResult {
  return simPaths(input, opts).result;
}

// The Monte Carlo, returning the summary and every path's dates from the same draws.
export function simPaths(
  input: SimInput,
  { seed = 1, paths = 10_000 }: SimOptions = {},
): { result: SimResult; paths: Paths } {
  const t0 = performance.now();
  const knots = asiKnots(input);
  const pBad = pBadOf(input, knots);
  const L = input.lagMeanYears;
  const y0 = Math.ceil(input.startYear);
  const byYear = new Float64Array(Math.max(0, HORIZON - y0 + 1));
  const cats = new Float64Array(paths);
  const asi = new Float64Array(paths).fill(Infinity);
  const cat = new Float64Array(paths).fill(Infinity);
  const mix: Record<Scenario, number> = { noAsi: 0, asiFine: 0, fastCat: 0, slowCat: 0 };
  let nCat = 0;
  const rand = mulberry32(seed);

  for (let i = 0; i < paths; i++) {
    // Always draw three uniforms so a path keeps its numbers when a slider moves
    // (common random numbers: yours vs real differ by the moves, not by noise).
    const u1 = rand();
    const u2 = rand();
    const u3 = rand();
    const t = arrivalYear(knots, u1);
    if (t > HORIZON) {
      mix.noAsi++;
      continue;
    }
    asi[i] = t;
    const lag = -L * Math.log(1 - u3);
    const c = t + lag;
    if (u2 >= pBad || c > HORIZON) {
      mix.asiFine++; // includes the rare doomed path whose catastrophe lands after 2100
      continue;
    }
    if (lag < 1) mix.fastCat++;
    else mix.slowCat++;
    cats[nCat++] = c;
    cat[i] = c;
    byYear[Math.ceil(c) - y0]++;
  }

  const fan: FanPoint[] = [];
  let cum = 0;
  let p10Year: number | null = null;
  for (let k = 0; k < byYear.length; k++) {
    cum += byYear[k];
    const p = cum / paths;
    fan.push({ year: y0 + k, p });
    if (p10Year === null && p >= 0.1) p10Year = y0 + k;
  }

  let medianCatDate: string | null = null;
  if (nCat > 0) {
    const sorted = cats.subarray(0, nCat).sort();
    const m = nCat >> 1;
    medianCatDate = yearToIso(nCat % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2);
  }

  for (const k of Object.keys(mix) as Scenario[]) mix[k] /= paths;
  const result: SimResult = {
    schema: "doomclock.sim/1",
    pCat2100: nCat / paths,
    medianCatDate,
    p10Year,
    fan,
    scenarioMix: mix,
    ms: performance.now() - t0,
  };
  return { result, paths: { asi, cat } };
}

// Decimal year (2031.5) -> ISO timestamp, UTC.
export function yearToIso(y: number): string {
  const year = Math.floor(y);
  const start = Date.UTC(year, 0, 1);
  return new Date(start + (y - year) * (Date.UTC(year + 1, 0, 1) - start)).toISOString();
}

function isProb(p: number): boolean {
  return Number.isFinite(p) && p >= 0 && p <= 1;
}
