// asOf(T): what was known at time T, the one point-in-time module. Every reader of data/clean goes through it:
// the state builder, the events file, the MiroFish seed, publish:cache (the browser World) and the backtest.
// Rule: nothing with ts >= T is ever returned (CLAUDE.md `ts < T`). Times are compared as numbers, never strings,
// so "…00Z" and "…00.000Z" are the same instant; a ts may also be epoch seconds or ms. Records with no parseable
// ts are dropped. Method and fields: docs/data/asof.md. Plain node, no deps.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AnchorHistory, CapabilityCurve, EventsFile, MarketInputs, MarketsFile, NodeId, StateFile, StateNode, StateWarning, WorldEvent,
} from "../../web/src/contracts.ts";
import { buildEvents } from "./events.ts";

export type Point = { t: number; p: number };
export type Rec = Record<string, any> & { ts: unknown };
export type Source =
  | "aiid" | "datacentres" | "doomsday_clock" | "epoch" | "government" | "kalshi" | "manifold" | "metr" | "polymarket"
  | "wikipedia_ai" | "world-facts" | "rss";
export interface AsOfOptions {
  /** data/clean by default; tests point it at a fixture directory. */
  clean?: string;
  /** doomclock/pipeline/markets.json by default. */
  markets?: MarketsFile;
}

export const CLEAN = join(import.meta.dirname, "../../../data/clean");
const MARKETS = join(import.meta.dirname, "../markets.json");
const DAY = 86_400_000;
/** The data window starts here: the 2024Q4 history point and the first real event. */
export const WINDOW_START = "2024-10-24T00:00:00Z";
const NODES: NodeId[] = ["asi2030", "asi2040", "asi2100", "cat2100"];

/** ISO UTC to the second. Sub-second times round up, so a ts is never earlier than the record was public. */
export const iso = (t: number) => new Date(Math.ceil(t / 1000) * 1000).toISOString().replace(".000Z", "Z");

/** A record's ts as epoch ms: an ISO string, or epoch seconds (< 1e11) or ms. NaN if it has none. */
export function tsMs(v: unknown): number {
  if (typeof v === "number") return v < 1e11 ? v * 1000 : v;
  if (v instanceof Date) return v.getTime();
  return typeof v === "string" && v ? Date.parse(v) : NaN;
}

// ---------- loading (cached per file) ----------

type Loaded = { t: number[]; rows: Rec[] }; // sorted by t
const files = new Map<string, Loaded>();
function load(dir: string, source: Source): Loaded {
  const path = join(dir, `${source}.jsonl`);
  let f = files.get(path);
  if (f) return f;
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { /* a missing source reads as empty */ }
  const all: { t: number; r: Rec }[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as Rec;
    const t = tsMs(r.ts);
    if (Number.isFinite(t)) all.push({ t, r }); // undated records are dropped
  }
  all.sort((a, b) => a.t - b.t);
  f = { t: all.map((x) => x.t), rows: all.map((x) => x.r) };
  files.set(path, f);
  return f;
}

const prices = new Map<string, Map<string, Point[]>>();
/** Price rows (kind=price) keyed by record id ("manifold:<id>", "kalshi:<ticker>", "pm:<id>"), each sorted by t. */
export function loadPrices(source: "manifold" | "kalshi" | "polymarket", dir = CLEAN): Map<string, Point[]> {
  const key = join(dir, source);
  let out = prices.get(key);
  if (out) return out;
  out = new Map();
  const { t, rows } = load(dir, source);
  rows.forEach((r, i) => {
    if (r.kind !== "price" || typeof r.p !== "number") return;
    let s = out!.get(r.id);
    if (!s) out!.set(r.id, (s = []));
    s.push({ t: t[i], p: r.p });
  });
  prices.set(key, out);
  return out;
}

/** First index with t >= T in a sorted array. */
function cut(ts: number[], T: number): number {
  let lo = 0, hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] < T) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The last point with t < T (a row exactly at T is excluded), carried forward, or null. `series` sorted by t. */
export function priceAt(series: Point[], T: string | number): { p: number; ts: string } | null {
  const tT = typeof T === "number" ? T : Date.parse(T);
  if (Number.isNaN(tT)) throw new Error(`priceAt: bad T ${T}`);
  let lo = 0, hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t < tT) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return null;
  const { t, p } = series[lo - 1];
  return { p, ts: iso(t) };
}

/** "manifold:x" / "kalshi:X" / "pm:1" as given; a bare id is a Kalshi ticker if upper-case, Polymarket if numeric. */
export function marketKey(id: string): { source: "manifold" | "kalshi" | "polymarket"; key: string } {
  const m = id.match(/^(manifold|kalshi|pm):/);
  if (m) return { source: m[1] === "pm" ? "polymarket" : (m[1] as "manifold" | "kalshi"), key: id };
  if (/^\d+$/.test(id)) return { source: "polymarket", key: `pm:${id}` };
  if (/^[A-Z0-9.-]+$/.test(id) && /[A-Z]/.test(id)) return { source: "kalshi", key: `kalshi:${id}` };
  return { source: "manifold", key: `manifold:${id}` };
}

// ---------- asOf ----------

export interface AsOf {
  /** T, ISO to the second, truncated (dropping data, never leaking it). */
  T: string;
  t: number;
  /** Clean rows of a source with ts < T, sorted by ts. */
  records(source: Source): Rec[];
  /** One market's daily closes with t < T. */
  series(marketId: string): Point[];
  /** The last close before T. */
  priceAt(marketId: string): { p: number; ts: string } | null;
  /** The four engine anchors (StateNode), with quarterly history and 12-month ranges. */
  anchors(): StateNode[];
  /** World.anchorHistory: each anchor's market and its dated prices. */
  anchorHistory(): Record<NodeId, AnchorHistory>;
  /** The Manifold warning markets, priced at T. */
  warnings(): StateWarning[];
  /** The KXAGICO capability curve; null before its first price (2026-03-04). */
  capabilityCurve(): CapabilityCurve | null;
  /** Real WorldEvents, WINDOW_START <= ts < T, with who/where/detail/major. */
  events(): WorldEvent[];
  /** Government records (data/clean/government.jsonl) with ts < T. */
  government(): Rec[];
  state(): StateFile;
  marketInputs(): MarketInputs | null;
  eventsFile(): EventsFile;
}

export function asOf(T: string | number | Date, opts: AsOfOptions = {}): AsOf {
  const raw = tsMs(T);
  if (!Number.isFinite(raw)) throw new Error(`asOf: bad T ${String(T)}`);
  const t = Math.floor(raw / 1000) * 1000;
  const Tiso = iso(t);
  const dir = opts.clean ?? CLEAN;
  let pins = opts.markets;
  const markets = () => (pins ??= JSON.parse(readFileSync(MARKETS, "utf8")) as MarketsFile);

  const records = (source: Source) => {
    const f = load(dir, source);
    return f.rows.slice(0, cut(f.t, t));
  };
  const series = (id: string) => {
    const { source, key } = marketKey(id);
    const s = loadPrices(source, dir).get(key) ?? [];
    return s.slice(0, cut(s.map((x) => x.t), t));
  };
  const at = (id: string) => priceAt(series(id), t);
  // The fetch-time market row (traders are as of the fetch: Manifold gives no history). Its ts is creation time.
  const marketRow = (key: string) => records(marketKey(key).source).find((r) => r.kind === "market" && r.id === marketKey(key).key);

  let nodes: StateNode[] | undefined;
  const anchors = () => (nodes ??= NODES.map((id): StateNode => {
    const pin = markets().manifold.find((m) => m.role === "anchor" && m.node === id);
    if (!pin) throw new Error(`markets.json has no anchor for ${id}`);
    const s = series(`manifold:${pin.id}`);
    const now = priceAt(s, t);
    if (!now) throw new Error(`${id}: no price before ${Tiso}`);
    // 12-month range: the price carried in at T-365d plus every daily close in [T-365d, T).
    const from = t - 365 * DAY;
    const carried = priceAt(s, from);
    const range = [...(carried ? [carried.p] : []), ...s.filter((x) => x.t >= from).map((x) => x.p)];
    const history: StateNode["history"] = [];
    for (let k = 0; ; k++) {
      const q = quarter(k);
      const qT = k === 0 ? Date.parse(WINDOW_START) : q.start;
      if (qT > t) break;
      const h = priceAt(s, qT);
      // p: null when the market had no price yet (contract says Prob; StateNode.history is typed loosely upstream).
      history.push({ q: q.q as StateNode["history"][number]["q"], T: iso(qT), p: h?.p ?? (null as unknown as number), ...(h && { ts: h.ts }) });
    }
    return {
      id, marketId: pin.id, label: pin.label, url: pin.url, horizonYear: pin.horizonYear!,
      pMarket: now.p, dlogit: 0, p: now.p,
      traders: marketRow(`manifold:${pin.id}`)?.traders ?? null,
      nPrices: s.length, lastTradeTs: now.ts,
      pRange12m: [Math.min(...range), Math.max(...range)],
      history,
    };
  }));

  const anchorHistory = () => {
    const out = {} as Record<NodeId, AnchorHistory>;
    for (const n of anchors()) {
      const pin = markets().manifold.find((m) => m.id === n.marketId);
      out[n.id] = { question: pin?.question ?? n.label, url: n.url, traders: n.traders, pRange12m: n.pRange12m, lastTradeTs: n.lastTradeTs, history: n.history };
    }
    return out;
  };

  const warnings = () => markets().manifold.filter((m) => m.role === "warning").flatMap((m): StateWarning[] => {
    const now = at(`manifold:${m.id}`);
    return now ? [{ marketId: m.id, label: m.label, url: m.url, horizonYear: new Date(m.deadline).getUTCFullYear(), pMarket: now.p, p: now.p }] : [];
  });

  const capabilityCurve = (): CapabilityCurve | null => {
    // Knots: (T, 0), since nothing qualifying has been announced, then each open "Before <date>" market of the
    // KXAGICO-COMP ladder at (close_time, price at T). Markets with no price before T add no knot.
    const knots = [{ t, p: 0 }];
    for (const r of records("kalshi")) {
      if (r.kind !== "market" || !String(r.id).startsWith("kalshi:KXAGICO-COMP-") || Date.parse(r.close_time) <= t) continue;
      const p = at(r.id);
      if (p) knots.push({ t: Date.parse(r.close_time), p: p.p });
    }
    if (knots.length === 1) return null;
    knots.sort((a, b) => a.t - b.t);
    const curveAt = (x: number) => {
      const i = knots.findIndex((k) => k.t >= x);
      if (i === -1) return knots.at(-1)!.p; // flat after the last knot
      const a = knots[i - 1], b = knots[i]; // i >= 1: only called for x > T = knots[0].t
      return a.p + ((b.p - a.p) * (x - a.t)) / (b.t - a.t);
    };
    let max = 0;
    const quarters = Array.from({ length: 45 }, (_, k) => {
      const { q, end } = quarter(k);
      max = Math.max(max, end <= t ? 0 : Math.round(curveAt(end) * 1e4) / 1e4);
      return { q: q as CapabilityCurve["quarters"][number]["q"], p: max };
    });
    return { ticker: "KXAGICO", rule: CURVE_RULE, monotonised: true, quarters };
  };

  let evs: WorldEvent[] | undefined;
  const events = () => (evs ??= buildEvents(
    { aiid: records("aiid"), government: records("government"), wikipedia: records("wikipedia_ai"), bulletin: records("doomsday_clock"), facts: records("world-facts") },
    WINDOW_START, Tiso,
  ).events);

  return {
    T: Tiso, t, records, series, priceAt: at, anchors, anchorHistory, warnings, capabilityCurve, events,
    government: () => records("government"),
    state: () => ({
      schema: "doomclock.state/2", asOf: Tiso, stale: false, w: 0,
      panel: { model: "none", trainingCutoff: "", personas: [] },
      nodes: anchors(), warnings: warnings(), headlines: [],
    }),
    marketInputs: () => {
      const c = capabilityCurve();
      return c && { schema: "doomclock.market-inputs/1", asOf: Tiso, capabilityCurve: c, cardPrices: [], originLab: [] };
    },
    eventsFile: () => ({ schema: "doomclock.events/1", asOf: Tiso, events: events() }),
  };
}

const CURVE_RULE =
  "P(any company officially announces it has achieved AGI) by the end of each quarter: an announcement, not ASI. " +
  "Kalshi KXAGICO-COMP ladder (real money), each 'Before <date>' market priced at asOf (last daily close before asOf) " +
  "and placed at its close_time, with 0 at asOf. Linear in time between dates, flat after the last date (Jan 2031, " +
  "i.e. after 2030), then cummax. Quarters that ended by asOf are 0: no qualifying announcement (26Q2 and 26Q3 resolved NO).";

/** Game quarters from 2024Q4: k = 0 is 2024Q4, k = 44 is 2035Q4. end = first instant of the next quarter. */
export function quarter(k: number) {
  const y = 2024 + Math.floor((k + 3) / 4), n = ((k + 3) % 4) + 1;
  return { q: `${y}Q${n}`, start: Date.UTC(y, 3 * n - 3, 1), end: Date.UTC(y, 3 * n, 1) };
}
