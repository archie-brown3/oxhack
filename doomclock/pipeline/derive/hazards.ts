// Market hazards per game turn (task 117, plan §6): the chance a measure or announcement happens in
// a quarter, from the Kalshi ladders at T0. Never typed by hand.
//   h = 1 - ((1 - P_end) / (1 - P_start))^(1 / quarters), on the cummax of each ladder.
// Reads data/clean/kalshi.jsonl (prices with ts < T0 only). Writes doomclock/web/src/game/data/hazards.json.
// Run: node doomclock/pipeline/derive/hazards.ts   (plain node, no deps)
import { readFileSync, writeFileSync } from "node:fs";

const T0 = "2026-10-24T00:00:00Z";
const root = new URL("../../../", import.meta.url);
const OUT = new URL("doomclock/web/src/game/data/hazards.json", root);
// Game turns 1..6 are 2027Q1..2028Q2; each starts on these dates.
const TURN_START = ["2027-01-01", "2027-04-01", "2027-07-01", "2027-10-01", "2028-01-01", "2028-04-01"];

interface Rung { id: string; before: string; p: number; ts: string }
interface Hazard { id: string; card: string | null; effect: string; series: string; question: string; ladder: Rung[]; perTurn: number[] }

type Row = { id: string; kind: string; ts: string; p?: number; title?: string; close_time?: string; series?: string };
const rows: Row[] = readFileSync(new URL("data/clean/kalshi.jsonl", root), "utf8").trim().split("\n").map((l) => JSON.parse(l));

// The last daily close before T0 for each market of a ladder, with its deadline.
function ladder(prefix: string): { rungs: Rung[]; question: string } {
  const markets = rows.filter((r) => r.kind === "market" && r.id.startsWith(`kalshi:${prefix}`));
  const rungs: Rung[] = [];
  for (const m of markets) {
    const prices = rows.filter((r) => r.kind === "price" && r.id === m.id && r.ts < T0);
    const last = prices.sort((a, b) => a.ts.localeCompare(b.ts)).at(-1);
    if (!last || last.p === undefined) continue;
    rungs.push({ id: m.id.replace("kalshi:", ""), before: m.close_time!.slice(0, 10), p: last.p, ts: last.ts });
  }
  rungs.sort((a, b) => a.before.localeCompare(b.before));
  // Cummax: a thin ladder can disagree with itself. A rung the cummax flattens says nothing new,
  // so it is dropped and the hazard spreads evenly across the wider window.
  let hi = -1;
  const kept = rungs.filter((r) => (r.p > hi ? ((hi = r.p), true) : false));
  return { rungs: kept, question: markets.at(-1)?.title ?? prefix };
}

// Quarters between two dates, rounded (each rung closes on a quarter boundary).
const quarters = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / (91.31 * 864e5));

// The hazard for each game turn: the rung pair whose window holds the turn's start. Turns past the
// last rung get 0 (no market says anything about them).
function perTurn(rungs: Rung[]): number[] {
  return TURN_START.map((start) => {
    const i = rungs.findIndex((r) => r.before > start);
    if (i <= 0) return 0;
    const a = rungs[i - 1], b = rungs[i];
    const h = 1 - ((1 - b.p) / (1 - a.p)) ** (1 / quarters(a.before, b.before));
    return Math.round(h * 1e4) / 1e4;
  });
}

function hazard(id: string, card: string | null, effect: string, prefix: string): Hazard {
  const { rungs, question } = ladder(prefix);
  if (rungs.length < 2) throw new Error(`hazards: ladder ${prefix} has ${rungs.length} priced rungs before T0`);
  return { id, card, effect, series: prefix.split("-")[0], question, ladder: rungs, perTurn: perTurn(rungs) };
}

const hazards = [
  hazard("regulator", "G1", "The world enacts the frontier licence for free.", "KXUSAIREGULATOR-28JAN01"),
  hazard("killswitch", "G5", "The world passes the kill-switch law for free.", "KXGOVAIKILLSWITCH-26SEP"),
  hazard("rsi", null, "A US frontier lab announces automated AI research: C_base +5, Alarm +1. Fires once.", "KXRSIANNOUNCE-29"),
];

const out = {
  schema: "doomclock.hazards/1",
  T0,
  label: "PROJECTED",
  source: "data/clean/kalshi.jsonl, last daily close before T0, cummax per ladder",
  formula: "h = 1 - ((1 - P_end) / (1 - P_start))^(1 / quarters)",
  turnStart: TURN_START,
  hazards,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
for (const h of hazards) console.log(h.id.padEnd(10), h.ladder.map((r) => `${r.before}:${r.p}`).join(" "), "->", h.perTurn.join(" "));
