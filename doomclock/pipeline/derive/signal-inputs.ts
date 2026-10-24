// data/signal-inputs.json (SignalInputs in doomclock/web/src/contracts.ts): the region weights behind the
// map tint and the AIID base rate λ behind the projected incident pings. Method: docs/data/signal-inputs.md.
// Reads data/clean/epoch.jsonl and data/clean/aiid.jsonl (read-only). Keeps any existing datacentres array.
// Run: node doomclock/pipeline/derive/signal-inputs.ts   (plain node, no deps)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";

const DATA = join(RAW, "..");
const OUT = join(DATA, "signal-inputs.json");
const jsonl = (f: string) => readFileSync(join(DATA, "clean", f), "utf8").trim().split("\n").map((l) => JSON.parse(l));

// λ needs AIID ts = max(first report, event_date) (item B). Refuse to compute on the old file.
const aiid = jsonl("aiid.jsonl");
if (aiid.some((r) => r.event_date && r.ts < r.event_date + "T00:00:00Z")) {
  console.error("wait for item B");
  process.exit(1);
}

// Region weights: share of notable models, split evenly across listed countries (same rules as regions.ts).
// The clean Epoch file already holds only the last 24 months.
type Region = "US" | "China" | "rest";
const region = (c: string): Region => (c === "United States of America" ? "US" : c === "China" ? "China" : "rest");
const w: Record<Region, number> = { US: 0, China: 0, rest: 0 };
let models = 0;
for (const m of jsonl("epoch.jsonl")) {
  const cs: string[] = (m.country ?? "").split(",").map((c: string) => c.trim()).filter(Boolean);
  if (cs.length) models++;
  for (const c of cs) w[region(c)] += 1 / cs.length;
}
const total = w.US + w.China + w.rest;

// λ: AIID incidents public 2025-01 .. 2026-09 (7 quarters). Oct 2026 is left out: AIID's latest month is undercounted.
const incidents = aiid.filter((r) => r.ts >= "2025-01-01" && r.ts < "2026-10-01").length;

const out = {
  schema: "doomclock.signal-inputs/1",
  regions: {
    US: w.US / total,
    China: w.China / total,
    rest: w.rest / total,
    metric: "share of notable AI models published in the last 24 months (a count, not compute)",
    source: "Epoch AI, notable AI models (epoch.ai/data/notable_ai_models.csv)",
  },
  warningRate: { perQuarter: incidents / 7, window: { from: "2025-01", to: "2026-09" }, source: "AIID" },
  // The datacentres agent owns this array; keep whatever it has written.
  datacentres: existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")).datacentres ?? []) : [],
  ticker: [], // phase 1: the ticker reads data/events.json
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`regions (${models} models):`, out.regions.US.toFixed(3), out.regions.China.toFixed(3), out.regions.rest.toFixed(3));
console.log(`warningRate: ${incidents} incidents / 7 quarters = ${out.warningRate.perQuarter.toFixed(2)} per quarter`);
console.log(`datacentres kept: ${out.datacentres.length}`);
