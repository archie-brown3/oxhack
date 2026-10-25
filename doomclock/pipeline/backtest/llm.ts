// Blind LLM baseline: google/gemini-2.5-flash on OpenRouter forecasts each pool question seeing
// ONLY the question text and the date T. Never the price, the outcome or the resolution date.
// Every API body is saved to data/raw/backtest/ before parsing. Parsed forecasts are appended to
// forecasts.jsonl (committed), so the run resumes and run.ts can score without the raw cache.
// Run: node --env-file=.env doomclock/pipeline/backtest/llm.ts [--limit 40] [--budget 1.5]
// Spend is the `usage.cost` OpenRouter returns, summed over forecasts.jsonl; the lane cap is $3.00.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { saveRaw } from "../lib/raw.ts";
import { loadPool, type Question } from "./pool.ts";
import { rng } from "./score.ts";

export const MODEL = "google/gemini-2.5-flash";
export const LANE_CAP_USD = 3.0;
export const FORECASTS = join(import.meta.dirname, "forecasts.jsonl");
/** Prompt version. v1 (pilot, 40 calls) let the model refuse: 5 of 40 gave no number. v2 forces
 *  the {"p"} JSON shape with a schema and caps the reply. Older rows still count toward spend. */
export const PROMPT_V = 2;
export type Forecast = { ts: string; id: string; T: string; model: string; v?: number; p: number | null; error?: string; cost: number; raw: string };

/** The whole prompt. It takes only the question text and the date, so nothing else can leak in. */
export function prompt(question: string, T: string) {
  return [
    { role: "system", content: `Today is ${T.slice(0, 10)}. You are a careful forecaster. You know nothing after today. Give the probability that the question below resolves YES. If you are unsure, give your best estimate anyway; never refuse. Reply with JSON only, like {"p": 0.25}.` },
    { role: "user", content: question },
  ];
}

/** {"p": x} with 0 ≤ x ≤ 1, optionally in a code fence; anything else is no forecast (null). */
export function parseP(content: unknown): number | null {
  if (typeof content !== "string") return null;
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[0])?.p;
    return typeof p === "number" && p >= 0 && p <= 1 ? p : null;
  } catch { return null; }
}

export function readForecasts(): Forecast[] {
  return existsSync(FORECASTS) ? readFileSync(FORECASTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
}

/** Deterministic order: a seeded shuffle, so the pilot is a random sample and the full run extends it. */
export function runOrder(qs: Question[]) {
  const r = rng(8), a = [...qs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// The key: OPENROUTER from the environment (node --env-file=.env), else the repo's .env.
function key() {
  if (process.env.OPENROUTER) return process.env.OPENROUTER;
  const env = join(import.meta.dirname, "../../../.env");
  const m = existsSync(env) && readFileSync(env, "utf8").match(/^OPENROUTER=(.*)$/m);
  if (!m) throw new Error("OPENROUTER is not set");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

async function ask(q: Question, apiKey: string): Promise<Forecast> {
  const body = {
    model: MODEL, temperature: 0, max_tokens: 40, reasoning: { enabled: false }, usage: { include: true }, messages: prompt(q.question, q.T),
    response_format: { type: "json_schema", json_schema: { name: "forecast", strict: true, schema: { type: "object", properties: { p: { type: "number" } }, required: ["p"], additionalProperties: false } } },
  };
  for (let i = 0; ; i++) {
    const fetched = new Date().toISOString();
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const text = await res.text();
    const raw = await saveRaw("backtest", `${fetched.replace(/[:.]/g, "-")}__${q.id.replace(/[^\w-]/g, "_")}.json`, JSON.stringify({ fetched_at: fetched, request: body, status: res.status, body: text }));
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* counted below */ }
    const cost = Number(j?.usage?.cost ?? 0);
    if (!res.ok && i < 3 && (res.status === 429 || res.status >= 500)) { await new Promise((r) => setTimeout(r, 2000 * 2 ** i)); continue; }
    const content = j?.choices?.[0]?.message?.content;
    const p = res.ok ? parseP(content) : null;
    const error = !res.ok ? `http ${res.status}` : p == null ? "bad JSON" : undefined;
    if (error) console.warn(`no forecast for ${q.id}: ${error} ${String(content ?? text).slice(0, 80)}`);
    return { ts: fetched.replace(/\.\d+Z$/, "Z"), id: q.id, T: q.T, model: MODEL, v: PROMPT_V, p, ...(error ? { error } : {}), cost, raw: raw.replace(/^.*data\/raw\//, "data/raw/") };
  }
}

if (import.meta.main) {
  const arg = (k: string, d: number) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
  const limit = arg("limit", Infinity), budget = arg("budget", LANE_CAP_USD);
  // --stop-at <ISO>: finish the calls in flight and stop by then (the society recording has the key 00:30–02:00 UTC).
  const stopAt = process.argv.includes("--stop-at") ? Date.parse(process.argv[process.argv.indexOf("--stop-at") + 1]) : Infinity;
  const done = readForecasts();
  const have = new Set(done.filter((f) => f.v === PROMPT_V).map((f) => f.id));
  let spent = done.reduce((s, f) => s + f.cost, 0);
  const cap = Math.min(LANE_CAP_USD, spent + budget);
  const todo = runOrder(loadPool().questions).slice(0, limit).filter((q) => !have.has(q.id));
  console.log(`${todo.length} to ask, spent so far $${spent.toFixed(4)}, stop at $${cap.toFixed(2)}`);
  const apiKey = key();
  let next = 0, n = 0, maxCost = 0.0005;
  const worker = async () => {
    while (next < todo.length) {
      if (spent + 8 * maxCost > cap || Date.now() > stopAt) return; // stop before the cap, allowing for the calls in flight
      const q = todo[next++];
      const f = await ask(q, apiKey);
      spent += f.cost; maxCost = Math.max(maxCost, f.cost);
      appendFileSync(FORECASTS, JSON.stringify(f) + "\n");
      if (++n % 50 === 0) console.log(`${n} done, $${spent.toFixed(4)}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`asked ${n}, total spent $${spent.toFixed(4)}${next < todo.length ? " (stopped at the budget)" : ""}`);
}
