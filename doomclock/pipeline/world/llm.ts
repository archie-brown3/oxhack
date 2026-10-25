// One strict-JSON LLM call for the read-out and the situation report (Amendments 2 and 7), like
// backtest/llm.ts: json_schema strict, temperature given by the caller, one retry on bad JSON.
// Every response body is saved to data/raw/readout/ in the main checkout (gitignored) before parsing.
// Cost is the `usage.cost` OpenRouter returns, logged as a lane "run" so budget.ts counts it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logCost } from "../mirofish/budget.ts";

export const READOUT_MODEL = "deepseek/deepseek-v4.1-flash-1017";
const RAW = join(process.env.HOME ?? "", "dev/oxhack/data/raw/readout");

function key() {
  if (process.env.OPENROUTER) return process.env.OPENROUTER;
  for (const f of [join(process.env.HOME ?? "", "dev/oxhack/.env")]) {
    const m = existsSync(f) && readFileSync(f, "utf8").match(/^OPENROUTER=["']?([^"'\n]+)/m);
    if (m) return m[1].trim();
  }
  throw new Error("OPENROUTER is not set");
}

export interface Asked<T> { value: T | null; cost: number; raw: string }

/** Asks for JSON matching `schema`; `check` validates the parsed value (null = invalid). Tries twice. */
export async function askJson<T>(label: string, messages: { role: string; content: string }[], schema: object, check: (v: any) => T | null, opts: { temperature?: number; maxTokens?: number } = {}): Promise<Asked<T>> {
  let cost = 0, raw = "";
  for (let i = 0; i < 2; i++) {
    const body = {
      model: READOUT_MODEL, temperature: opts.temperature ?? 0, max_tokens: opts.maxTokens ?? 3000, reasoning: { enabled: false }, usage: { include: true }, messages,
      response_format: { type: "json_schema", json_schema: { name: label.replace(/\W/g, "_").slice(0, 40), strict: true, schema } },
    };
    const fetched = new Date().toISOString();
    let text = "";
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      text = await res.text();
      mkdirSync(RAW, { recursive: true });
      writeFileSync(join(RAW, `${fetched.replace(/[:.]/g, "-")}__${label.replace(/[^\w-]/g, "_")}__${i}.json`), JSON.stringify({ fetched_at: fetched, request: body, status: res.status, body: text }));
      const j = JSON.parse(text);
      const c = Number(j?.usage?.cost ?? 0);
      cost += c;
      if (c) logCost({ event: "run", label: `llm ${label}`, cost_usd: c, wall_s: 0 });
      raw = String(j?.choices?.[0]?.message?.content ?? "");
      const m = raw.match(/\{[\s\S]*\}/);
      const v = m ? check(JSON.parse(m[0])) : null;
      if (v !== null) return { value: v, cost, raw };
    } catch (e) { raw = raw || String(e).slice(0, 200); }
    if (i === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  return { value: null, cost, raw };
}
