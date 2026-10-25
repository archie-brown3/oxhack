// Lab weights for cast.json: each lab's share of Epoch notable models published from
// 2024-10-24 to T0 (2026-10-24), normalised over the cast's 8 labs, rounded to 3 dp so they sum
// to exactly 1 (largest remainder). Only rows with ts < T0 are read.
// Usage: node doomclock/pipeline/world/cast-weights.ts [--write]   (prints; --write updates cast.json)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../../..");
const CAST = join(ROOT, "doomclock/pipeline/world/cast/cast.json");
const FROM = Date.parse("2024-10-24T00:00:00Z");

/** Epoch `org` names (comma-separated in the data) that count for each cast lab. */
export const LAB_ORGS: Record<string, string[]> = {
  OpenAI: ["OpenAI"],
  Anthropic: ["Anthropic"],
  "Google DeepMind": ["Google DeepMind", "Google"],
  Meta: ["Meta AI", "Meta"],
  xAI: ["xAI"],
  DeepSeek: ["DeepSeek"],
  "Alibaba Qwen": ["Alibaba"],
  Nvidia: ["Nvidia", "NVIDIA"],
};

export function labWeights(epochJsonl: string, T0: string): Record<string, number> {
  const to = Date.parse(T0);
  const counts: Record<string, number> = Object.fromEntries(Object.keys(LAB_ORGS).map((k) => [k, 0]));
  for (const line of epochJsonl.split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { ts: string; org?: string; kind?: string };
    const t = Date.parse(r.ts);
    if (!(t >= FROM && t < to) || (r.kind && r.kind !== "model")) continue;
    const orgs = String(r.org ?? "").split(/,\s*/);
    for (const [lab, names] of Object.entries(LAB_ORGS)) if (orgs.some((o) => names.includes(o))) counts[lab]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const exact = Object.entries(counts).map(([lab, c]) => [lab, (1000 * c) / total] as const);
  const floor = exact.map(([lab, x]) => [lab, Math.floor(x), x - Math.floor(x)] as const);
  let left = 1000 - floor.reduce((s, [, f]) => s + f, 0);
  const out: Record<string, number> = {};
  for (const [lab, f] of floor) out[lab] = f;
  for (const [lab] of [...floor].sort((a, b) => b[2] - a[2])) if (left-- > 0) out[lab]++;
  for (const lab in out) out[lab] /= 1000;
  return out;
}

if (import.meta.main) {
  const cast = JSON.parse(readFileSync(CAST, "utf8"));
  const w = labWeights(readFileSync(join(ROOT, "data/clean/epoch.jsonl"), "utf8"), cast.asOf);
  console.log(w);
  if (process.argv.includes("--write")) {
    for (const a of cast.accounts) if (a.group === "lab") a.weight = w[a.name];
    writeFileSync(CAST, JSON.stringify(cast, null, 2) + "\n");
    console.log("wrote", CAST);
  }
}
