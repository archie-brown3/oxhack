// The situation report (Amendment 7). The rubric is scored from event objects only, with written
// level anchors, at temperature 0; each item moves at most +-1 per step. The summary and the 3-5
// plausible next events are a second call that may also read the top posts and our own numbers.
// Bad JSON keeps the last scores and gives no expectations.
import type { Rubric, SimEventType } from "../../web/src/contracts.ts";
import { askJson } from "./llm.ts";

const ITEMS = ["lossOfControl", "misuse", "oversight", "racePressure"] as const;

export const ANCHORS = `Score each item from 0 to 3 for the period, from the listed events only.
lossOfControl: 0 = no AI system acted outside its operator's control; 1 = minor cases, quickly contained; 2 = repeated or serious cases, or a lab pauses because of one; 3 = a system acted against its operators at scale, or attacked a government or critical system and was not quickly contained.
misuse: 0 = no notable misuse; 1 = scams, deepfakes or similar at the usual rate; 2 = organised misuse, or misuse that harmed a government or critical system; 3 = misuse with mass harm, or a state using AI to attack another.
oversight (3 = strong): 0 = no binding rule or evaluator access; 1 = statements, hearings and proposals only; 2 = at least one binding rule in force that labs must follow; 3 = several binding rules in force, with enforcement or an international agreement.
racePressure: 0 = labs and governments are slowing down; 1 = steady competition; 2 = clear acceleration: new compute, removed barriers, rival releases; 3 = open race: emergency compute programmes, labs dropping safeguards to keep up.`;

const RUBRIC_SCHEMA = {
  type: "object", additionalProperties: false, required: [...ITEMS],
  properties: Object.fromEntries(ITEMS.map((k) => [k, { type: "object", additionalProperties: false, required: ["score", "cites"], properties: { score: { type: "integer", enum: [0, 1, 2, 3] }, cites: { type: "array", items: { type: "string" } } } }])),
} as const;

export interface Scored { rubric: Rubric; cites: Record<string, string[]>; ok: boolean; cost: number }

/** Scores the formatted period. `prev` is the last scores (the baseline at step 1); a move is clamped to +-1 of it. */
export async function scoreRubric(label: string, formatted: string, prev: Rubric, opts: { temperature?: number; clamp?: boolean } = {}): Promise<Scored> {
  const r = await askJson(`rubric-${label}`, [
    { role: "system", content: `You score the state of the world for AI risk. ${ANCHORS}\nCite the event ids (E1, E2...) behind each score. If the list is thin, score from what is there and do not guess. Reply as JSON.` },
    { role: "user", content: formatted },
  ], RUBRIC_SCHEMA, (v) => (ITEMS.every((k) => Number.isInteger(v?.[k]?.score) && v[k].score >= 0 && v[k].score <= 3) ? v : null), { temperature: opts.temperature ?? 0, maxTokens: 800 });
  if (!r.value) return { rubric: prev, cites: {}, ok: false, cost: r.cost };
  const rubric = { ...prev };
  const cites: Record<string, string[]> = {};
  for (const k of ITEMS) {
    const s = r.value[k].score as number;
    rubric[k] = opts.clamp === false ? s : Math.max(prev[k] - 1, Math.min(prev[k] + 1, s));
    cites[k] = (r.value[k].cites as string[]).filter((c) => /^E\d+$/.test(c));
  }
  return { rubric, cites, ok: true, cost: r.cost };
}

export interface Expectation { who: string; what: string; why: string; type: SimEventType | "other" }
const EXPECT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "expected"],
  properties: {
    summary: { type: "string" },
    expected: { type: "array", items: { type: "object", additionalProperties: false, required: ["who", "what", "why", "type"], properties: { who: { type: "string" }, what: { type: "string" }, why: { type: "string" }, type: { type: "string", enum: ["lab-incident-agentic", "incident-misuse", "incident-other", "act-accelerating", "act-restricting", "lab-pause", "agreement", "soft", "other"] } } } },
  },
} as const;

/** 2-3 sentences quoting only our own numbers (`facts`), and 3-5 plausible events for the next 6 months. */
export async function summarise(label: string, formatted: string, topPosts: string[], facts: string): Promise<{ summary: string; expected: Expectation[]; cost: number; ok: boolean }> {
  const allowed = new Set(facts.match(/\d+(?:\.\d+)?/g) ?? []);
  const r = await askJson(`summary-${label}`, [
    { role: "system", content: `You write the situation report for a simulated period. Summary: 2 or 3 plain sentences about what happened and what it did to the clock. Use only numbers from OUR NUMBERS; add no other figures, dates or documents. Expected: 3 to 5 plausible events for the next 6 months: who would act, what, why (cite this period's event ids like E2 in the why). They are expectations, not facts. Reply as JSON.` },
    { role: "user", content: `OUR NUMBERS: ${facts}\n\nEVENTS:\n${formatted}\n\nTOP POSTS (simulated):\n${topPosts.join("\n")}` },
  ], EXPECT_SCHEMA, (v) => {
    if (typeof v?.summary !== "string" || !Array.isArray(v.expected) || v.expected.length < 3) return null;
    const nums = v.summary.match(/\d+(?:\.\d+)?/g) ?? [];
    return nums.every((n: string) => allowed.has(n)) ? v : null;
  }, { temperature: 0, maxTokens: 1200 });
  if (!r.value) return { summary: "", expected: [], cost: r.cost, ok: false };
  return { summary: r.value.summary.trim(), expected: r.value.expected.slice(0, 5), cost: r.cost, ok: true };
}
