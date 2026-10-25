// One step of the coupled loop (spec: docs/superpowers/specs/2026-10-25-doom-clock-coupled-loop-design.md,
// Amendments 6, 7, 9): how a future's four anchors move over one 6-month MiroFish step.
// Pure: the same arguments always give the same anchors. Shared by the recorder (Node) and the browser.
// Every number below is a GAME RULE: no market or dataset backs it (an event study found the anchors
// too thin to fit them). The UI labels them so.
import type { Dlogit, IsoTime, NodeId, Prob, Rubric, SimEventType, WorldEvent } from "../contracts.ts";
import { mulberry32 } from "./rng.ts";

export type Anchors = Record<NodeId, Prob>;

/** The event types that push the "when" anchors. 'soft', 'other', 'agreement', misuse and other incidents
 *  have no effect. */
export type RuleType = Extract<SimEventType, "lab-incident-agentic" | "act-accelerating" | "act-restricting" | "lab-pause">;
export const RULE_TYPES: RuleType[] = ["lab-incident-agentic", "act-accelerating", "act-restricting", "lab-pause"];

/** Real events per 6 months (data/events.json). Counts at this rate give zero push. */
export const REAL_RATE: Record<RuleType, number> = {
  "lab-incident-agentic": 1.7,
  "act-accelerating": 3,
  "act-restricting": 2,
  "lab-pause": 1,
};
/** A count is capped here before it is compared with its real rate. */
export const COUNT_CAP = 3;

/** Logit push per event above (or below) the real rate: [asi2030, asi2040]. */
export const NUDGE: Record<RuleType, [Dlogit, Dlogit]> = {
  "lab-incident-agentic": [0.08, 0.04],
  "act-accelerating": [0.03, 0.015],
  "act-restricting": [-0.04, -0.02],
  "lab-pause": [-0.1, -0.05],
};
/** The rule sum is clipped to the real 6-month p90 of the anchor's logit moves. */
export const CLIP_WHEN: Pick<Record<NodeId, number>, "asi2030" | "asi2040"> = { asi2030: 0.63, asi2040: 0.49 };
/** Seeded noise (logit σ) per step. asi2100 and cat2100 get none. */
export const NOISE_SD: Pick<Record<NodeId, number>, "asi2030" | "asi2040"> = { asi2030: 0.35, asi2040: 0.25 };

/** cat2100 is a level: logit(today) + Σ β (score − baseline), clipped. */
export const BETA: Rubric = { lossOfControl: 0.15, misuse: 0.05, oversight: -0.1, racePressure: 0.08 };
export const CLIP_CAT = 0.75;
/** The asi2030 market resolves at this decimal year; its decay stops just short of it. */
const ASI2030_YEAR = 2030;

export interface StepArgs {
  /** Anchors going into the step (the previous step's `anchors`, or the future's `startAnchors`). */
  from: Anchors;
  /** The future's `startAnchors`: cat2100 is read as a level from here. */
  today: Anchors;
  /** The step covers [start, end). */
  start: IsoTime;
  end: IsoTime;
  /** The step's events, deduped. Only their `type`, `binding` and `severity` are read. */
  events: readonly Pick<WorldEvent, "type" | "binding" | "severity">[];
  rubric: Rubric;
  /** The rubric scored on the real last 6 months (`RecordedFuture.baselineRef`). */
  baseline: Rubric;
  /** Seeds the noise with `step`: the same (future, step) draws the same numbers. */
  future: number;
  step: number;
}

/** Switch parts off for the comparison lines. Rules off: `{ nudges: false, rubric: false }` (same noise).
 *  Today's odds, no events: `{ nudges: false, rubric: false, noise: false }` (decay only). */
export interface StepOpts {
  nudges?: boolean;
  rubric?: boolean;
  noise?: boolean;
}

/** The anchors after one step: decay, centred rule nudges, clip, seeded noise; cat2100 from the rubric. */
export function stepAnchors(a: StepArgs, { nudges = true, rubric = true, noise = true }: StepOpts = {}): Anchors {
  const t0 = msToYear(Date.parse(a.start));
  const t1 = Math.min(msToYear(Date.parse(a.end)), ASI2030_YEAR - 1e-3);
  const push = nudges ? whenPush(a.events) : { asi2030: 0, asi2040: 0 };
  // Always draw both normals so the noise is the same whatever is switched off.
  const rand = mulberry32(hash(a.future, a.step));
  const z = [gauss(rand), gauss(rand)];

  // asi2030 decays as the year approaches: constant hazard, 1 - (1 - p0)^((2030 - t1) / (2030 - t0)).
  const decayed = t0 < ASI2030_YEAR ? 1 - Math.pow(1 - a.from.asi2030, Math.max(0, ASI2030_YEAR - t1) / (ASI2030_YEAR - t0)) : a.from.asi2030;
  const when = (p: Prob, d: Dlogit, clip: number, sd: number, k: number) =>
    expit(logit(p) + clamp(d, clip) + (noise ? sd * z[k] : 0));

  const cat = rubric ? clamp(rubricPush(a.rubric, a.baseline), CLIP_CAT) : 0;
  return {
    asi2030: when(decayed, push.asi2030, CLIP_WHEN.asi2030, NOISE_SD.asi2030, 0),
    asi2040: when(a.from.asi2040, push.asi2040, CLIP_WHEN.asi2040, NOISE_SD.asi2040, 1),
    asi2100: a.from.asi2100,
    cat2100: expit(logit(a.today.cat2100) + cat),
  };
}

type Typed = Pick<WorldEvent, "type" | "binding" | "severity">;

/** The rule type an event counts as, or null. Incidents count only when major, acts only when binding. */
export function ruleType(e: Typed): RuleType | null {
  switch (e.type) {
    case "lab-incident-agentic":
      return e.severity === "major" ? e.type : null;
    case "act-accelerating":
    case "act-restricting":
      return e.binding ? e.type : null;
    case "lab-pause":
      return e.type;
    default:
      return null;
  }
}

/** Events of each rule type (before the cap). Log these against REAL_RATE. */
export function ruleCounts(events: readonly Typed[]): Record<RuleType, number> {
  const n = Object.fromEntries(RULE_TYPES.map((t) => [t, 0])) as Record<RuleType, number>;
  for (const e of events) {
    const t = ruleType(e);
    if (t) n[t]++;
  }
  return n;
}

/** The centred push on the "when" anchors, before clipping: Σ over types of nudge × (min(count, 3) − real rate). */
export function whenPush(events: readonly Typed[]): { asi2030: Dlogit; asi2040: Dlogit } {
  const n = ruleCounts(events);
  const out = { asi2030: 0, asi2040: 0 };
  for (const t of RULE_TYPES) {
    const excess = Math.min(n[t], COUNT_CAP) - REAL_RATE[t];
    out.asi2030 += NUDGE[t][0] * excess;
    out.asi2040 += NUDGE[t][1] * excess;
  }
  return out;
}

/** Each event's share of its type's push, for `WorldEvent.effect`. A type's push is split evenly over its
 *  events, so shares sum to the type's centred total (which can be negative for a lone event). Events that
 *  count as nothing get null. */
export function eventEffects(events: readonly Typed[]): ({ dlogit: Partial<Record<NodeId, Dlogit>>; rule: string } | null)[] {
  const n = ruleCounts(events);
  return events.map((e) => {
    const t = ruleType(e);
    if (!t) return null;
    const excess = (Math.min(n[t], COUNT_CAP) - REAL_RATE[t]) / n[t];
    return { dlogit: { asi2030: NUDGE[t][0] * excess, asi2040: NUDGE[t][1] * excess }, rule: "GAME RULE" };
  });
}

/** Σ β (score − baseline), before clipping. */
export function rubricPush(rubric: Rubric, baseline: Rubric): Dlogit {
  let s = 0;
  for (const k of Object.keys(BETA) as (keyof Rubric)[]) s += BETA[k] * (rubric[k] - baseline[k]);
  return s;
}

// ---------- helpers ----------

/** Decimal year of an epoch-ms time, by calendar-year fraction (as sim.ts's yearToIso). */
export function msToYear(ms: number): number {
  const y = new Date(ms).getUTCFullYear();
  const a = Date.UTC(y, 0, 1);
  return y + (ms - a) / (Date.UTC(y + 1, 0, 1) - a);
}

const EPS = 1e-6;
function logit(p: number): number {
  const q = Math.min(1 - EPS, Math.max(EPS, p));
  return Math.log(q / (1 - q));
}
function expit(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
function clamp(x: number, lim: number): number {
  return Math.max(-lim, Math.min(lim, x));
}
function hash(future: number, step: number): number {
  return Math.imul(Math.imul(future | 0, 0x9e3779b1) ^ Math.imul(step | 0, 0x85ebca6b), 0xc2b2ae35) >>> 0;
}
// Box-Muller.
function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}
