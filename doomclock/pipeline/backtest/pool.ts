// The backtest pool: resolved YES/NO AI questions from data/clean (Manifold, Polymarket, Kalshi),
// each with one forecast date T = resolution − 30 days and the market price at T (last price with ts < T).
// buildPool is pure (tested in pool.test.ts); loadPool reads the clean files.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { priceAt, type Point } from "../lib/price-at.ts";

export const SOURCES = ["manifold", "polymarket", "kalshi"] as const;
export type Source = (typeof SOURCES)[number];
export const HORIZON_DAYS = 30;
/** google/gemini-2.5-flash's training cutoff is 2025-01-31; a question counts only if cutoff + 1 month ≤ T. */
export const MODEL_CUTOFF = "2025-01-31";
export const EARLIEST_T = "2025-03-01T00:00:00Z";
export const MIN_TRADERS = 20; // Manifold only: play money, so one trader can swing a thin market

export type Rec = { ts: string; kind: string; id: string; [k: string]: unknown };
export type Question = {
  id: string; source: Source; group: string; question: string; url: string;
  T: string; t: number; resolvedTs: string; resolved: number; y: 0 | 1;
  market: { p: number; ts: string };
};
export type Dropped = Record<string, number>;

const DAY = 86_400_000;

/** The question text the blind model sees. Kalshi ladders carry the strike in the subtitle. */
function text(src: Source, m: Rec): string {
  if (src === "kalshi") {
    const title = String(m.title ?? ""), sub = String(m.subtitle ?? "");
    return sub && !title.includes(sub) ? `${title} (${sub})` : title;
  }
  return String(m.question ?? "");
}

export function buildPool(src: Source, recs: Rec[]): { questions: Question[]; dropped: Dropped } {
  const markets = new Map<string, Rec>(), prices = new Map<string, Point[]>(), resolutions: Rec[] = [];
  for (const r of recs) {
    if (r.kind === "market") markets.set(r.id, r);
    else if (r.kind === "price") { const s = prices.get(r.id) ?? []; s.push({ t: Date.parse(r.ts), p: Number(r.p) }); prices.set(r.id, s); }
    else if (r.kind === "resolution") resolutions.push(r);
  }
  for (const s of prices.values()) s.sort((a, b) => a.t - b.t);
  const dropped: Dropped = {}, drop = (why: string) => void (dropped[why] = (dropped[why] ?? 0) + 1);
  const questions: Question[] = [];
  for (const r of resolutions) {
    if (r.result !== "YES" && r.result !== "NO") { drop("not YES/NO"); continue; }
    const m = markets.get(r.id);
    if (!m) { drop("no market record"); continue; }
    const resolved = Date.parse(r.ts), t = resolved - HORIZON_DAYS * DAY, T = new Date(t).toISOString().replace(".000Z", "Z");
    if (t < Date.parse(EARLIEST_T)) { drop("T before model cutoff + 1 month"); continue; }
    if (src === "manifold" && Number(m.traders ?? 0) < MIN_TRADERS) { drop("under 20 traders"); continue; }
    if (!(Date.parse(m.ts) < t)) { drop("opened after T"); continue; }
    const q = text(src, m);
    if (!q) { drop("no question text"); continue; }
    const at = priceAt(prices.get(r.id) ?? [], T);
    if (!at) { drop("no price before T"); continue; }
    if (!(Date.parse(at.ts) < t)) throw new Error(`leak: price ${at.ts} not before T ${T} for ${r.id}`);
    const group = String(m.event ?? m.event_id ?? r.id);
    questions.push({ id: r.id, source: src, group: `${src}:${group}`, question: q, url: String(m.url ?? ""), T, t, resolvedTs: r.ts, resolved, y: r.result === "YES" ? 1 : 0, market: at });
  }
  return { questions, dropped };
}

const CLEAN = join(import.meta.dirname, "../../../data/clean");
export function loadPool() {
  const all: Question[] = [], dropped: Record<string, Dropped> = {};
  for (const src of SOURCES) {
    const recs = readFileSync(join(CLEAN, `${src}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Rec);
    const out = buildPool(src, recs);
    all.push(...out.questions);
    dropped[src] = out.dropped;
  }
  all.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  return { questions: all, dropped };
}
