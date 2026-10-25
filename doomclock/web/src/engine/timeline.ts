// The Timeline module, the engine's one seam. buildTimeline(world, pick) plays one of 10,000
// Monte Carlo futures quarter by quarter; readClock(world) reads the forecast across all of them.
// Pure: the same world and pick always give the same Timeline. No dependencies; runs in the
// browser and under plain `node`.
import type {
  ClockDriver,
  ClockReading,
  IsoTime,
  NodeId,
  Prob,
  QuarterLabel,
  RecordedFuture,
  Region,
  SampledFuture,
  Timeline,
  World,
  WorldEvent,
  WorldFrame,
} from "../contracts.ts";
import { mulberry32 } from "./rng.ts";
import { msToYear } from "./step.ts";
import { analyticCdf, asiKnots, HORIZON, simPaths } from "./sim.ts";
import type { Paths, SimInput } from "./sim.ts";

export const FUTURES = 10_000;
/** The watched-future chip: Early / Typical / Late, as percentiles over ALL futures. */
export const PICKS = { early: 0.1, typical: 0.5, late: 0.9 } as const;
/** One future, by a seed (Roll) or by its rank (a percentile in [0, 1]). */
export type Pick = { seed: number } | { percentile: number };

const MC_SEED = 1; // the 10,000 futures are fixed; a pick only chooses among them
const P10 = 0.1; // the clock reads the date P(catastrophe) passes 1 in 10
const LAG_RANGE = [1, 10] as const; // years: the date10 arc
const FRAMES = 45; // 2024Q4 .. 2035Q4
const NODES: NodeId[] = ["asi2030", "asi2040", "asi2100", "cat2100"];
const DAY = 864e5;

type Anchors = Record<NodeId, Prob>;
type Ranges = Record<NodeId, [Prob, Prob]>;

export function readClock(world: World): ClockReading {
  const { clock } = reading(world.anchors, msToYear(parseTime(world.asOf)), world.lagMeanYears, todayRanges(world));
  return withSeconds(clock, secondsPerYear(world, clock));
}

// The face's calibration (owner, 24 Oct): today's hand sits at the Bulletin's setting, so
// k = Bulletin seconds / years to today's date10. A display scale, not a forecast.
function secondsPerYear(world: World, today: ClockReading): number | null {
  const m = today.minutesToMidnight;
  return m ? world.bulletinSeconds / m : null;
}

function withSeconds(clock: ClockReading, k: number | null): ClockReading {
  const m = clock.minutesToMidnight;
  return { ...clock, secondsToMidnight: k === null || m === null ? null : k * m };
}

// With a recording (`sim`), the quarters of its steps read that future's saved anchors instead of
// today's, and the Monte Carlo is skipped: the future has no ASI or catastrophe date (null), its
// events are the recording's, and its frames are 'simulated'. Without one the output is today's.
export function buildTimeline(world: World, pick: Pick, sim?: RecordedFuture): Timeline {
  const asOf = parseTime(world.asOf);
  const now = msToYear(asOf);
  const L = world.lagMeanYears;
  const input = simInput(world.anchors, now, L);
  const future = sim ? { id: sim.id, percentile: 0, asiDate: null, catDate: null } : choose(simPaths(input, { seed: MC_SEED, paths: FUTURES }).paths, pick);
  const today = reading(world.anchors, now, L, todayRanges(world));
  const perYear = secondsPerYear(world, today.clock);
  const quarters = Array.from({ length: FRAMES }, (_, k) => quarter(k));
  const capability = capabilityCurve(world, quarters);
  const regions = normalise(world.regions);
  const events = frameEvents(world, asOf, sim);
  const incidents = Math.round(world.warningRate.perQuarter);

  // The markets behind each frame's clock: real frames read the quarter's readings; projected
  // frames keep today's anchors and date10, so only the minutes move.
  const todayTs = {} as Record<NodeId, IsoTime>;
  for (const id of NODES) todayTs[id] = world.anchorHistory[id].lastTradeTs;
  const ranges = todayRanges(world);
  const simmed = quarters.map((q) => (sim && q.start >= asOf ? simStep(sim, q.start) : null));
  const snaps = quarters.map((q, k): Snap | null => {
    const st = simmed[k];
    if (st) {
      // Quarter 1 of a step reads the incoming anchors, quarter 2 the outgoing ones.
      const first = q.start === Date.parse(st.step.start);
      const a = first ? st.prev : st.step.anchors;
      const ts = {} as Record<NodeId, IsoTime>;
      for (const id of NODES) ts[id] = first ? st.step.start : st.step.end;
      const at = msToYear(q.start);
      return { a, ts, at, ...reading(a, at, L, ranges) };
    }
    if (sim && q.start >= asOf) {
      // Past the recording: hold its final anchors, so only the minutes move.
      const last = sim.steps.at(-1)!;
      const at = msToYear(Date.parse(last.end));
      const ts = Object.fromEntries(NODES.map((id) => [id, last.end])) as Record<NodeId, IsoTime>;
      return { a: last.anchors, ts, at, ...reading(last.anchors, at, L, ranges) };
    }
    return q.start >= asOf ? { a: world.anchors, ts: todayTs, at: now, ...today } : quarterSnap(world, q.label, L);
  });

  const frames = quarters.map((q, k): WorldFrame => {
    const snap = snaps[k];
    const projected = q.start >= asOf;
    const held = projected && !simmed[k];
    const clock =
      snap &&
      withSeconds(held ? { ...snap.clock, minutesToMidnight: minutesTo(snap.clock.date10, msToYear(q.start)) } : snap.clock, perYear);
    const f: WorldFrame = {
      quarter: q.label,
      start: iso(q.start),
      provenance: simmed[k] ? "simulated" : projected ? "projected" : "real",
      capability: capability[k],
      regions,
      // The CDF the paths sample, as the clock reads it, so date10 lands in the first frame past 1 in 10.
      pCat: analyticCdf(snap && simmed[k] ? simInput(snap.a, snap.at, L) : input, Math.max(simmed[k] && snap ? snap.at : now, msToYear(q.end))),
      events: events[k],
      clock,
      ...explain(world, snaps[k - 1] ?? null, snap, L),
    };
    if (projected) f.incidentsExpected = incidents;
    return f;
  });

  return { schema: "doomclock.timeline/1", asOf: world.asOf, frames, clock: withSeconds(today.clock, perYear), line: "real", future };
}

// The recorded step that covers a time, with the anchors going into it. Null outside the recording.
function simStep(sim: RecordedFuture, ms: number) {
  const i = sim.steps.findIndex((s) => ms >= Date.parse(s.start) && ms < Date.parse(s.end));
  return i < 0 ? null : { step: sim.steps[i], prev: i ? sim.steps[i - 1].anchors : sim.startAnchors };
}

// ---------- the clock ----------

// ASI knots sit at the market deadlines (1 Jan 2030 / 2040 / 2100).
function simInput(a: Anchors, startYear: number, lagMeanYears: number): SimInput {
  return {
    startYear,
    asi: [
      { year: 2030, p: a.asi2030 },
      { year: 2040, p: a.asi2040 },
      { year: 2100, p: a.asi2100 },
    ].filter((k) => k.year > startYear), // a resolved market has no knot (reading after 2030.0 would throw)
    pCat2100: a.cat2100,
    lagMeanYears,
  };
}

// The year P(catastrophe) first reaches 1 in 10: bisection on the model's continuous CDF (the
// distribution the 10,000 paths sample). Null if it stays under 1 in 10 through 2100.
function year10(input: SimInput): number | null {
  const knots = asiKnots(input);
  if (analyticCdf(input, HORIZON, knots) < P10) return null;
  let lo = input.startYear;
  let hi = HORIZON;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (analyticCdf(input, mid, knots) < P10) lo = mid;
    else hi = mid;
  }
  return hi;
}

// The clock for these anchors, read at decimal year `at`. `y10` is the unrounded date10 year.
// The range varies the lag over 1..10 y and each anchor over its price range, alone and together:
// date10 is monotone in each input, so the corners of the box hold the extremes.
function reading(a: Anchors, at: number, L: number, ranges: Ranges): { clock: ClockReading; y10: number | null } {
  const y10 = year10(simInput(a, at, L));
  const lag = LAG_RANGE.map((l) => year10(simInput(a, at, l)));
  const market: (number | null)[] = [];
  const all = [y10, ...lag];
  for (let m = 0; m < 1 << NODES.length; m++) {
    const c = { ...a };
    NODES.forEach((id, i) => {
      const [lo, hi] = ranges[id];
      c[id] = (m >> i) & 1 ? Math.max(hi, a[id]) : Math.min(lo, a[id]);
    });
    market.push(year10(simInput(c, at, L)));
    for (const l of LAG_RANGE) all.push(year10(simInput(c, at, l)));
  }
  const date10 = day(y10);
  const clock: ClockReading = {
    date10,
    date10Range: span([...all, ...market]),
    date10RangeBy: { lag: span(lag), market: span(market) },
    minutesToMidnight: minutesTo(date10, at),
    secondsToMidnight: null, // set by withSeconds
    pCat2100: analyticCdf(simInput(a, at, L), HORIZON),
  };
  return { clock, y10 };
}

// [earliest, latest] of date10 years; null (past 2100) sorts last.
function span(ys: (number | null)[]): [IsoTime | null, IsoTime | null] {
  const v = ys.map((y) => y ?? Infinity);
  return [day(Math.min(...v)), day(Math.max(...v))];
}

function day(y: number | null): IsoTime | null {
  return y === null || !Number.isFinite(y) ? null : isoDay(yearToMs(y));
}

function todayRanges(world: World): Ranges {
  const r = {} as Ranges;
  for (const id of NODES) r[id] = world.anchorHistory[id].pRange12m;
  return r;
}

// A real quarter: each anchor's reading for it, read at the latest of their T, with each anchor's
// price range taken from its readings in the 12 months to then. Null if an anchor has no reading.
function quarterSnap(world: World, label: QuarterLabel, L: number): Snap | null {
  const a = {} as Anchors;
  const ts = {} as Record<NodeId, IsoTime>;
  let at = -Infinity;
  for (const id of NODES) {
    const h = world.anchorHistory[id].history.find((x) => x.q === label);
    if (!h) return null;
    a[id] = h.p;
    ts[id] = h.ts ?? h.T;
    at = Math.max(at, parseTime(h.T));
  }
  const ranges = {} as Ranges;
  for (const id of NODES) {
    const ps = world.anchorHistory[id].history.filter((x) => {
      const t = Date.parse(x.T);
      return t <= at && t > at - 365 * DAY;
    });
    ranges[id] = [Math.min(...ps.map((x) => x.p)), Math.max(...ps.map((x) => x.p))];
  }
  const year = msToYear(at);
  return { a, ts, at: year, ...reading(a, year, L, ranges) };
}

// 1 minute = 1 year, from decimal year `at` to date10; 0 once date10 has passed.
function minutesTo(date10: IsoTime | null, at: number): number | null {
  return date10 === null ? null : Math.max(0, msToYear(Date.parse(date10)) - at);
}

// ---------- drivers ----------

interface Snap {
  a: Anchors;
  ts: Record<NodeId, IsoTime>; // when each anchor's price was set
  at: number; // decimal year the reading is made
  clock: ClockReading;
  y10: number | null;
}

// Why date10 moved since the previous frame. First time passes at the old prices (the ASI curve
// restarts at 0 when the forecast is read), then each anchor that moved is moved alone (leave-one-
// out), the rest held. What's left is their interaction. A date10 past 2100 counts as 2100.
function explain(world: World, prev: Snap | null, cur: Snap | null, L: number) {
  if (!prev || !cur) return { drivers: [] as ClockDriver[], timeDays: 0, residualDays: 0 };
  const days = (y: number | null) => yearToMs(y ?? HORIZON) / DAY;
  const base = days(year10(simInput(prev.a, cur.at, L)));
  const timeDays = round1(base - days(prev.y10));
  const drivers = NODES.filter((id) => cur.a[id] !== prev.a[id]).map((id): ClockDriver => {
    const h = world.anchorHistory[id];
    const moved = year10(simInput({ ...prev.a, [id]: cur.a[id] }, cur.at, L));
    return {
      anchorId: id,
      label: h.question,
      url: h.url,
      traders: h.traders,
      from: prev.a[id],
      to: cur.a[id],
      ts: cur.ts[id],
      effectDays: days(moved) - base,
    };
  });
  const total = days(cur.y10) - base;
  const residualDays = round1(total - drivers.reduce((s, d) => s + d.effectDays, 0));
  for (const d of drivers) d.effectDays = round1(d.effectDays);
  drivers.sort((x, y) => Math.abs(y.effectDays) - Math.abs(x.effectDays));
  return { drivers, timeDays, residualDays };
}

// ---------- futures ----------

// Rank every future by catastrophe date (none by 2100 ranks last), then superintelligence date.
function choose({ asi, cat }: Paths, pick: Pick): SampledFuture {
  const n = cat.length;
  const cmp = (x: number, y: number) => (x < y ? -1 : x > y ? 1 : 0);
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => cmp(cat[i], cat[j]) || cmp(asi[i], asi[j]) || i - j);
  let index: number;
  let rank: number;
  if ("percentile" in pick) {
    const q = pick.percentile;
    if (!(q >= 0 && q <= 1)) throw new Error(`timeline: bad percentile ${q}`);
    rank = Math.min(n - 1, Math.floor(q * n + 1e-9)); // a future's own percentile picks it again
    index = order[rank];
  } else {
    if (!Number.isFinite(pick.seed)) throw new Error(`timeline: bad seed ${pick.seed}`);
    index = Math.floor(mulberry32(pick.seed)() * n);
    rank = order.indexOf(index);
  }
  const date = (y: number) => (Number.isFinite(y) ? iso(yearToMs(y)) : null);
  return { id: index + 1, percentile: rank / n, asiDate: date(asi[index]), catDate: date(cat[index]) };
}

// ---------- frame contents ----------

interface Quarter {
  label: QuarterLabel;
  start: number; // epoch ms
  end: number;
}

function quarter(k: number): Quarter {
  const start = Date.UTC(2024, 9 + 3 * k, 1);
  const d = new Date(start);
  const label = `${d.getUTCFullYear()}Q${d.getUTCMonth() / 3 + 1}` as QuarterLabel;
  return { label, start, end: Date.UTC(2024, 12 + 3 * k, 1) };
}

// Frame index of a time, or -1 outside 2024Q4..2035Q4.
function frameOf(ms: number): number {
  const d = new Date(ms);
  const k = (d.getUTCFullYear() - 2024) * 4 + Math.floor(d.getUTCMonth() / 3) - 3;
  return k >= 0 && k < FRAMES ? k : -1;
}

// The Kalshi curve by quarter label, cummax'd; a missing quarter carries the last value.
function capabilityCurve(world: World, quarters: Quarter[]): Prob[] {
  const byQ = new Map(world.capabilityCurve.quarters.map((x) => [x.q, x.p]));
  let cap = 0;
  return quarters.map((q) => (cap = Math.max(cap, byQ.get(q.label) ?? cap)));
}

function normalise({ US, China, rest }: Record<Region, number>): Record<Region, number> {
  const sum = US + China + rest;
  if (!(sum > 0)) throw new Error("timeline: region weights must sum to more than 0");
  return { US: US / sum, China: China / sum, rest: rest / sum };
}

// Real events before asOf, plus the recording's simulated events. No incidents are invented for the
// future quarters: the frame carries the real rate as a count (`incidentsExpected`).
function frameEvents(world: World, asOf: number, sim?: RecordedFuture): WorldEvent[][] {
  const out: WorldEvent[][] = Array.from({ length: FRAMES }, () => []);
  for (const e of world.events) {
    const t = Date.parse(e.ts);
    if (!(t < asOf)) continue; // never show anything after asOf as real
    const k = frameOf(t);
    if (k >= 0) out[k].push(e);
  }
  for (const e of sim?.steps.flatMap((s) => s.events) ?? []) {
    const k = frameOf(Date.parse(e.ts));
    if (k >= 0) out[k].push(e);
  }
  for (const b of out) b.sort((x, y) => Date.parse(x.ts) - Date.parse(y.ts));
  return out;
}

// ---------- time ----------

function parseTime(s: IsoTime): number {
  const t = Date.parse(s);
  if (!Number.isFinite(t)) throw new Error(`timeline: bad time ${s}`);
  return t;
}

// Decimal year <-> epoch ms, by calendar-year fraction (as sim.ts's yearToIso).
function yearToMs(year: number): number {
  const y = Math.floor(year);
  const a = Date.UTC(y, 0, 1);
  return a + (year - y) * (Date.UTC(y + 1, 0, 1) - a);
}

// ISO to the second, no ms (as data/); isoDay floors to UTC midnight.
function iso(ms: number): IsoTime {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(".000Z", "Z");
}

function isoDay(ms: number): IsoTime {
  return iso(Math.floor(ms / DAY) * DAY);
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
