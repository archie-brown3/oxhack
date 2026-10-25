// A thin client for the patched MiroFish backend (http://localhost:5001) and the sim folders it
// writes. Only the calls the recorded runs and the smoke tests need. No dependencies.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BASE = process.env.MIROFISH_URL ?? "http://localhost:5001";
export const SIM_ROOT = join(process.env.MIROFISH_DIR ?? join(process.env.HOME ?? "", "dev/MiroFish"), "backend/uploads/simulations");

export async function call<T = any>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", "Accept-Language": "en" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
  if (!r.ok || j.success === false) throw new Error(`${method} ${path}: HTTP ${r.status} ${j.error ?? ""}`.trim());
  return (j.data ?? j) as T;
}

export const start = (simulation_id: string, max_rounds: number, force = true) =>
  call("POST", "/api/simulation/start", { simulation_id, platform: "parallel", max_rounds, force });
export const runStatus = (id: string) => call("GET", `/api/simulation/${id}/run-status`);
export const closeEnv = (simulation_id: string) => call("POST", "/api/simulation/close-env", { simulation_id });

export interface ActionLine { round?: number; timestamp: string; event_type?: string; agent_id?: number; action_type?: string; action_args?: Record<string, unknown>; [k: string]: unknown }

/** twitter/actions.jsonl for a sim; [] if it is missing. */
export function actions(id: string): ActionLine[] {
  const f = join(SIM_ROOT, id, "twitter", "actions.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as ActionLine);
}

/** MiroFish writes local wall-clock times without a zone; this reads them as this machine's local time. */
export const localToIso = (t: string) => new Date(t).toISOString();

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls actions.jsonl until a simulation_end later than `after` (epoch ms) appears. */
export async function waitForEnd(id: string, after: number, timeoutMs: number): Promise<ActionLine> {
  const t0 = Date.now();
  for (;;) {
    const end = actions(id).find((a) => a.event_type === "simulation_end" && Date.parse(a.timestamp) > after);
    if (end) return end;
    if (Date.now() - t0 > timeoutMs) throw new Error(`${id}: no simulation_end after ${timeoutMs / 1000} s`);
    await sleep(2000);
  }
}
