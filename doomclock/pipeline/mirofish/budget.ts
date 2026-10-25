// Budget guard for every paid MiroFish/OpenRouter run. It reads total key usage from
// GET https://openrouter.ai/api/v1/key and refuses to start a run once usage reaches CAP_USD
// (default $10, task 102) or the lane's own logged spend reaches LANE_CAP_USD (default $1). Every check is
// appended to data/world/cost-log.jsonl. The key is read from the environment or a .env file
// and is never printed.
// Usage: node doomclock/pipeline/mirofish/budget.ts [label]   (exits 1 when over a cap)
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const LOG = join(import.meta.dirname, "../../../data/world/cost-log.jsonl");
const CAP_USD = Number(process.env.CAP_USD ?? 10);
const LANE_CAP_USD = Number(process.env.LANE_CAP_USD ?? 1.0);
const HOME = process.env.HOME ?? "";
const ENV_FILES = [join(HOME, "dev/MiroFish/.env"), join(HOME, "dev/oxhack/.env")];

function key(): string {
  const env = process.env.OPENROUTER ?? process.env.LLM_API_KEY;
  if (env) return env;
  for (const f of ENV_FILES) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^(?:LLM_API_KEY|OPENROUTER)=["']?([^"'\n]+)/m);
    if (m) return m[1].trim();
  }
  throw new Error("budget: no OpenRouter key in OPENROUTER, LLM_API_KEY or a .env file");
}

export interface KeyInfo { usage: number; limit: number | null; limit_remaining: number | null; is_free_tier: boolean }

export async function keyInfo(): Promise<KeyInfo> {
  const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key()}` } });
  if (!r.ok) throw new Error(`budget: key check failed, HTTP ${r.status}`);
  const d = ((await r.json()) as { data: KeyInfo }).data;
  return { usage: d.usage, limit: d.limit, limit_remaining: d.limit_remaining, is_free_tier: d.is_free_tier };
}

function laneRuns(): number {
  if (!existsSync(LOG)) return 0;
  return readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    .filter((e) => e.event === "run" && typeof e.cost_usd === "number").reduce((s, e) => s + e.cost_usd, 0);
}

export function logCost(entry: Record<string, unknown>) {
  mkdirSync(dirname(LOG), { recursive: true });
  appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
}

/** Throws (and logs the refusal) when key usage is at or above either cap; returns usage in USD. */
export async function guard(label: string): Promise<number> {
  const { usage } = await keyInfo();
  // Other lanes share the key, so the lane's spend is the sum of its own logged run costs (each
  // a key-usage delta over the run, so an upper bound), not usage minus the starting usage.
  const laneSpent = laneRuns();
  const over =
    usage >= CAP_USD ? `total usage $${usage.toFixed(4)} >= CAP_USD $${CAP_USD}`
    : laneSpent >= LANE_CAP_USD ? `lane spend $${laneSpent.toFixed(4)} >= LANE_CAP_USD $${LANE_CAP_USD}`
    : null;
  logCost({ event: over ? "refused" : "check", label, usage, laneSpent: +laneSpent.toFixed(6), CAP_USD, LANE_CAP_USD, ...(over ? { reason: over } : {}) });
  if (over) throw new Error(`budget: refusing ${label}: ${over}`);
  return usage;
}

if (import.meta.main) {
  guard(process.argv[2] ?? "manual check").then(
    (u) => console.log(`budget ok: usage $${u.toFixed(4)}, CAP_USD $${CAP_USD}, lane cap $${LANE_CAP_USD}`),
    (e) => { console.error(String(e.message ?? e)); process.exit(1); },
  );
}
