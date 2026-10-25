// data/lab-weights.json: each of the game's 8 labs' share of Epoch AI's notable models published in the two
// years to T0, normalised over the 8. Feeds the lab personas' weights (game plan §4). A count of models, not of
// compute or capability. Reads data/clean/epoch.jsonl through asOf(T).
// Run: node doomclock/pipeline/derive/weights.ts [--asOf=ISO]   (default: the data freeze in data/state.json)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asOf } from "../asof/asof.ts";

const DATA = join(import.meta.dirname, "../../../data");
// Epoch `org` values counted for each lab: a model whose org is exactly one of these. Multi-org rows (a lab plus
// universities) are left out, so a lab is credited only for its own models. GDM includes the 2 models listed as Google.
export const LABS: { lab: string; region: "US" | "China"; orgs: string[] }[] = [
  { lab: "OpenAI", region: "US", orgs: ["OpenAI"] },
  { lab: "Google DeepMind", region: "US", orgs: ["Google DeepMind", "Google"] },
  { lab: "Alibaba", region: "China", orgs: ["Alibaba"] },
  { lab: "Anthropic", region: "US", orgs: ["Anthropic"] },
  { lab: "Meta", region: "US", orgs: ["Meta AI"] },
  { lab: "DeepSeek", region: "China", orgs: ["DeepSeek"] },
  { lab: "xAI", region: "US", orgs: ["xAI"] },
  { lab: "Nvidia", region: "US", orgs: ["Nvidia"] },
];

export function labWeights(T: string, years = 2) {
  const a = asOf(T);
  const from = new Date(a.t);
  from.setUTCFullYear(from.getUTCFullYear() - years);
  const models = a.records("epoch").filter((r) => r.kind === "model" && Date.parse(String(r.ts)) >= from.getTime());
  const counted = LABS.map((l) => ({ ...l, count: models.filter((m) => l.orgs.includes(m.org)).length }));
  const total = counted.reduce((s, l) => s + l.count, 0);
  return {
    schema: "doomclock.lab-weights/1",
    asOf: a.T,
    window: { from: from.toISOString().replace(".000Z", "Z"), to: a.T },
    metric: "Share of Epoch AI notable models published in the window, normalised over the 8 labs (a model count, not compute).",
    source: "https://epoch.ai/data/notable-ai-models",
    labs: counted.map(({ lab, region, orgs, count }) => ({ lab, region, orgs, count, weight: Math.round((count / total) * 1e4) / 1e4 })),
  };
}

if (import.meta.main) {
  const arg = process.argv.find((x) => x.startsWith("--asOf="))?.slice(7);
  const T = arg ?? JSON.parse(readFileSync(join(DATA, "state.json"), "utf8")).asOf;
  const out = labWeights(T);
  writeFileSync(join(DATA, "lab-weights.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`lab-weights.json asOf ${out.asOf}:`, out.labs.map((l) => `${l.lab} ${l.count} (${l.weight})`).join(", "));
}
