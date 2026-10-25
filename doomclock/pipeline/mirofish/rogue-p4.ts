// P4 (task 124): 20 LLM Rogue calls with the final prompt at temperature 0.5 over varied game states.
// Bars: >= 19 of 20 legal, p95 <= 10 s, >= 5 distinct move pairs. Spend cap $0.25 (checked against the
// per-call cost OpenRouter reports). Raw replies go to data/raw/openrouter-rogue/ before parsing.
// Writes data/tests/p4.json. The key comes from OPENROUTER / LLM_API_KEY or ~/dev/oxhack/.env, never printed.
// Run: node doomclock/pipeline/mirofish/rogue-p4.ts   (DOOMCLOCK_RAW overrides the raw directory)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";
import { guard, logCost } from "./budget.ts";
import { autoTurn, newGame } from "../../web/src/game/reducer.ts";
import { llmRogue, ROGUE_MODEL } from "../../web/src/game/rogue-llm.ts";
import type { GameState } from "../../web/src/game/types.ts";

const CALLS = 20;
const CAP_USD = 0.25;
const RAW_DIR = join(process.env.DOOMCLOCK_RAW ?? RAW, "openrouter-rogue");
const OUT = join(import.meta.dirname, "../../../data/tests/p4.json");

function apiKey(): string {
  const env = process.env.OPENROUTER ?? process.env.LLM_API_KEY;
  if (env) return env;
  for (const f of [join(process.env.HOME ?? "", "dev/oxhack/.env"), join(process.env.HOME ?? "", "dev/MiroFish/.env")]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^(?:OPENROUTER|LLM_API_KEY)=["']?([^"'\n]+)/m);
    if (m) return m[1].trim();
  }
  throw new Error("rogue-p4: no OpenRouter key");
}

// Varied states: seeds 1..20, each played by the auto-Guardian to a different turn (0..5).
function states(): GameState[] {
  return Array.from({ length: CALLS }, (_, i) => {
    let s = newGame(i + 1);
    for (let t = 0; t < i % 6 && !s.outcome; t++) s = autoTurn(s, { epsilon: 0.1 }).state;
    return s;
  });
}

await guard("rogue-p4");
mkdirSync(RAW_DIR, { recursive: true });
const key = apiKey();
const rows = [];
let spent = 0;
for (const [i, s] of states().entries()) {
  if (spent >= CAP_USD) { rows.push({ i, skipped: "spend cap" }); continue; }
  const r = await llmRogue(s, {
    apiKey: key,
    onRaw: (body) => writeFileSync(join(RAW_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-${i}.json`), JSON.stringify(body)),
  });
  spent += r.costUsd ?? 0;
  rows.push({ i, turn: s.turn + 1, key: s.key, ok: r.ok, error: r.error ?? null, ms: r.ms, costUsd: r.costUsd ?? null, moves: r.play.moves, rationale: r.play.rationale, sock_text: r.play.sock_text ?? null, taunt: r.play.taunt ?? null });
  console.log(i, r.ok ? "legal" : `fallback (${r.error})`, `${r.ms} ms`, r.play.moves.map((m) => m.id + (m.target ?? "")).join("+"));
}
const done = rows.filter((r) => "ok" in r) as { ok: boolean; ms: number; moves: { id: string; target?: number }[] }[];
const legal = done.filter((r) => r.ok).length;
const ms = done.map((r) => r.ms).sort((a, b) => a - b);
const p95 = ms[Math.min(ms.length - 1, Math.ceil(0.95 * ms.length) - 1)] ?? null;
const pairs = new Set(done.filter((r) => r.ok).map((r) => r.moves.map((m) => m.id).sort().join("+"))).size;
const bars = [
  { bar: ">= 19 of 20 legal", value: legal, pass: legal >= 19 },
  { bar: "p95 <= 10 s", value: p95, pass: p95 !== null && p95 <= 10_000 },
  { bar: ">= 5 distinct move pairs", value: pairs, pass: pairs >= 5 },
];
logCost({ event: "run", label: "rogue-p4", cost_usd: +spent.toFixed(6) });
writeFileSync(OUT, JSON.stringify({ schema: "doomclock.p4/1", ranAt: new Date().toISOString(), model: ROGUE_MODEL, temperature: 0.5, calls: CALLS, spentUsd: +spent.toFixed(5), capUsd: CAP_USD, bars, pass: bars.every((b) => b.pass), rows }, null, 2) + "\n");
for (const b of bars) console.log(b.pass ? "PASS" : "FAIL", b.bar, b.value);
console.log(`spent $${spent.toFixed(4)}`);
