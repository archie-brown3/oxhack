// Region weights (US / China / rest) from Epoch's notable-models data, under several metrics.
// Reads data/clean/epoch.jsonl (last 24 months; read-only) and the raw notable_ai_models CSV (all time; read-only).
// A model listing several countries is split evenly between them; models with no country are left out.
// Run: node doomclock/pipeline/derive/regions.ts   (plain node, no deps)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";

type Region = "US" | "China" | "rest";
type M = { date: string; country: string; compute: number | null; frontier: boolean };

const region = (c: string): Region => (c === "United States of America" ? "US" : c === "China" ? "China" : "rest");
const countries = (s: string | null) => (s ?? "").split(",").map((c) => c.trim()).filter(Boolean);

// all time: raw CSV (newest copy)
function parseCsv(t: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows[0];
  return rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}
const file = readdirSync(join(RAW, "epoch")).filter((f) => f.startsWith("notable_ai_models.")).sort().at(-1)!;
const all: M[] = parseCsv(readFileSync(join(RAW, "epoch", file), "utf8")).map((r) => ({
  date: r["Publication date"],
  country: r["Country (of organization)"],
  compute: +r["Training compute (FLOP)"] > 0 ? +r["Training compute (FLOP)"] : null,
  frontier: r["Frontier model"] === "True",
}));

// last 24 months: the clean file
const recent: M[] = readFileSync(join(RAW, "../clean/epoch.jsonl"), "utf8").trim().split("\n").map((l) => {
  const r = JSON.parse(l);
  return { date: r.ts.slice(0, 10), country: r.country, compute: r.training_compute_flop, frontier: r.frontier };
});

function weights(ms: M[], weight: (m: M) => number | null) {
  const w: Record<Region, number> = { US: 0, China: 0, rest: 0 };
  for (const m of ms) {
    const cs = countries(m.country), x = weight(m);
    if (!cs.length || x == null) continue;
    for (const c of cs) w[region(c)] += x / cs.length;
  }
  const t = w.US + w.China + w.rest;
  return { US: w.US / t, China: w.China / t, rest: w.rest / t, n: ms.filter((m) => countries(m.country).length && weight(m) != null).length };
}

const metrics: [string, M[], (m: M) => number | null][] = [
  ["notable models, all time", all, () => 1],
  ["notable models, last 24 months", recent, () => 1],
  ["training compute, all time", all, (m) => m.compute],
  ["training compute, last 24 months", recent, (m) => m.compute],
  ["frontier models, all time", all, (m) => (m.frontier ? 1 : null)],
  ["frontier models, last 24 months", recent, (m) => (m.frontier ? 1 : null)],
];
const dist = (a: { US: number; China: number; rest: number }, b = { US: 0.58, China: 0.3, rest: 0.12 }) =>
  Math.max(Math.abs(a.US - b.US), Math.abs(a.China - b.China), Math.abs(a.rest - b.rest));

console.log(`source: ${file} (all time, ${all.length} rows), data/clean/epoch.jsonl (24 months, ${recent.length} rows)`);
console.log("metric".padEnd(36), "US".padStart(6), "China".padStart(6), "rest".padStart(6), "   n", " max|diff| vs 0.58/0.30/0.12");
for (const [name, ms, f] of metrics) {
  const w = weights(ms, f);
  const p = (x: number) => x.toFixed(2).padStart(6);
  console.log(name.padEnd(36), p(w.US), p(w.China), p(w.rest), String(w.n).padStart(5), " ", dist(w).toFixed(3));
}
