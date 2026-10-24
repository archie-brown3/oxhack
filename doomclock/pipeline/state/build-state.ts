// data/state.json (StateFile) and data/market-inputs.json (MarketInputs) as of one instant, from the clean market
// files and the pins in markets.json. Every price is priceAt(asOf): the last daily close strictly before asOf.
// Phase 1: no panel, so w = 0, dlogit = 0 and p = pMarket. Method and fields: docs/data/state.md.
// Run: node doomclock/pipeline/state/build-state.ts [--asOf=2026-10-24T18:00:00Z]   (plain node, no deps; default: now)
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPrices, priceAt } from "../lib/price-at.ts";

const DATA = join(import.meta.dirname, "../../../data");
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
const jsonl = (f: string) => readFileSync(join(DATA, "clean", f), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const write = (f: string, v: unknown) => writeFileSync(join(DATA, f), JSON.stringify(v, null, 2) + "\n");

// asOf to the second, truncated: rounding down can only drop data, never leak it.
const arg = process.argv.find((a) => a.startsWith("--asOf="))?.slice("--asOf=".length);
const asOfMs = Math.floor((arg ? Date.parse(arg) : Date.now()) / 1000) * 1000;
if (Number.isNaN(asOfMs)) throw new Error(`bad --asOf: ${arg}`);
const asOf = iso(asOfMs);

// Game quarters from 2024Q4: k = 0 is 2024Q4, k = 44 is 2035Q4. end = first instant of the next quarter.
const quarter = (k: number) => {
  const y = 2024 + Math.floor((k + 3) / 4), n = ((k + 3) % 4) + 1;
  return { q: `${y}Q${n}`, start: Date.UTC(y, 3 * n - 3, 1), end: Date.UTC(y, 3 * n, 1) };
};
const HISTORY_START = Date.parse("2024-10-24T00:00:00Z"); // 2024Q4's point: the start of the data window

// ---------- state.json ----------

const pins = JSON.parse(readFileSync(join(import.meta.dirname, "../markets.json"), "utf8"));
const manifold = jsonl("manifold.jsonl");
const prices = loadPrices("manifold");
const nodes = ["asi2030", "asi2040", "asi2100", "cat2100"].map((id) => {
  const pin = pins.manifold.find((m: { role: string; node?: string }) => m.role === "anchor" && m.node === id);
  if (!pin) throw new Error(`markets.json has no anchor for ${id}`);
  const s = prices.get(`manifold:${pin.id}`) ?? [];
  const now = priceAt(s, asOf);
  if (!now) throw new Error(`${id}: no price before ${asOf}`);

  // 12-month range: the price carried in at asOf-365d plus every daily close in [asOf-365d, asOf).
  const from = asOfMs - 365 * DAY;
  const inWindow = s.filter((x) => x.t >= from && x.t < asOfMs).map((x) => x.p);
  const carried = priceAt(s, iso(from));
  const range = carried ? [carried.p, ...inWindow] : inWindow;

  const history: { q: string; T: string; p: number | null }[] = [];
  for (let k = 0; ; k++) {
    const T = k === 0 ? HISTORY_START : quarter(k).start;
    if (T > asOfMs) break;
    history.push({ q: quarter(k).q, T: iso(T), p: priceAt(s, iso(T))?.p ?? null });
  }

  return {
    id,
    marketId: pin.id,
    label: pin.label,
    url: pin.url,
    horizonYear: pin.horizonYear,
    pMarket: now.p,
    dlogit: 0,
    p: now.p,
    // As of the 24 Oct 2026 fetch, not as of asOf: Manifold gives no trader count history.
    traders: manifold.find((r) => r.kind === "market" && r.id === `manifold:${pin.id}`)?.traders ?? null,
    nPrices: s.filter((x) => x.t < asOfMs).length,
    lastTradeTs: now.ts,
    pRange12m: [Math.min(...range), Math.max(...range)],
    history,
  };
});

write("state.json", {
  schema: "doomclock.state/2",
  asOf,
  stale: false,
  w: 0,
  panel: { model: "none", trainingCutoff: "", personas: [] },
  nodes,
  warnings: [],
  headlines: [],
});

// ---------- market-inputs.json: the KXAGICO capability curve ----------

// Knots: (asOf, 0), since nothing qualifying has been announced yet, then each open "Before <date>" market of the
// KXAGICO-COMP ladder at (close_time, price at asOf). Markets with no price before asOf add no knot.
const kalshi = loadPrices("kalshi");
const knots = [{ t: asOfMs, p: 0 }];
for (const r of jsonl("kalshi.jsonl")) {
  if (r.kind !== "market" || !r.id.startsWith("kalshi:KXAGICO-COMP-") || Date.parse(r.close_time) <= asOfMs) continue;
  const at = priceAt(kalshi.get(r.id) ?? [], asOf);
  if (at) knots.push({ t: Date.parse(r.close_time), p: at.p });
}
knots.sort((a, b) => a.t - b.t);

const RULE =
  "P(any company officially announces it has achieved AGI) by the end of each quarter: an announcement, not ASI. " +
  "Kalshi KXAGICO-COMP ladder (real money), each 'Before <date>' market priced at asOf (last daily close before asOf) " +
  "and placed at its close_time, with 0 at asOf. Linear in time between dates, flat after the last date (Jan 2031, " +
  "i.e. after 2030), then cummax. Quarters that ended by asOf are 0: no qualifying announcement (26Q2 and 26Q3 resolved NO).";

if (knots.length === 1) {
  // KXAGICO has prices only from 2026-03-04. Before that there is no curve to write; don't invent one. Delete any
  // file from another asOf too, or a later-priced curve would sit beside this state.json. Exit 1: the pair is incomplete.
  rmSync(join(DATA, "market-inputs.json"), { force: true });
  console.warn(`no KXAGICO-COMP price before ${asOf}: market-inputs.json deleted, not written`);
  process.exitCode = 1;
} else {
  const curveAt = (t: number) => {
    const i = knots.findIndex((k) => k.t >= t);
    if (i === -1) return knots.at(-1)!.p; // flat after the last knot
    const a = knots[i - 1], b = knots[i]; // i >= 1: only called for t > asOf = knots[0].t
    return a.p + ((b.p - a.p) * (t - a.t)) / (b.t - a.t);
  };
  let max = 0;
  const quarters = Array.from({ length: 45 }, (_, k) => {
    const { q, end } = quarter(k);
    max = Math.max(max, end <= asOfMs ? 0 : Math.round(curveAt(end) * 1e4) / 1e4);
    return { q, p: max };
  });
  write("market-inputs.json", {
    schema: "doomclock.market-inputs/1",
    asOf,
    capabilityCurve: { ticker: "KXAGICO", rule: RULE, monotonised: true, quarters },
    cardPrices: [],
    originLab: [],
  });
  const show = quarters.filter((x) => /Q4$/.test(x.q)).map((x) => `${x.q} ${x.p}`).join(", ");
  console.log(`market-inputs.json: ${quarters.length} quarters from ${knots.length - 1} knots; ${show}`);
}

console.log(`state.json asOf ${asOf}:`, nodes.map((n) => `${n.id} ${n.pMarket} (${n.nPrices} closes, ${n.history.length} quarters)`).join(", "));
