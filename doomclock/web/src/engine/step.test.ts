import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { eventEffects, readClock, REAL_RATE, RULE_TYPES, ruleCounts, stepAnchors, whenPush } from "./index.ts";
import type { Anchors, StepArgs } from "./index.ts";
import type { RecordedFuture, Rubric, SimEventType, World, WorldEvent } from "../contracts.ts";

const world: World = JSON.parse(readFileSync(new URL("./fixtures/world.fixture.json", import.meta.url), "utf8"));
const flat: Rubric = { lossOfControl: 1, misuse: 2, oversight: 1, racePressure: 2 };
const base: StepArgs = {
  from: world.anchors,
  today: world.anchors,
  start: "2027-01-01T00:00:00Z",
  end: "2027-07-01T00:00:00Z",
  events: [],
  rubric: flat,
  baseline: flat,
  future: 1,
  step: 1,
};
const ev = (type: SimEventType, binding = true, severity: WorldEvent["severity"] = "major") => ({ type, binding, severity });
const near = (a: Anchors, b: Anchors, tol = 1e-12) => (Object.keys(a) as (keyof Anchors)[]).every((k) => Math.abs(a[k] - b[k]) < tol);

test("the same seed gives the same anchors; another future or step differs", () => {
  assert.deepEqual(stepAnchors(base), stepAnchors({ ...base }));
  assert.notDeepEqual(stepAnchors(base), stepAnchors({ ...base, future: 2 }));
  assert.notDeepEqual(stepAnchors(base), stepAnchors({ ...base, step: 2 }));
});

test("zero nudges, zero noise and no time passing is the identity", () => {
  const still = { ...base, end: base.start };
  assert.ok(near(stepAnchors(still, { nudges: false, noise: false }), world.anchors));
});

test("a rubric equal to the baseline adds nothing; cat2100 is a level, not a ratchet", () => {
  assert.ok(Math.abs(stepAnchors(base, { noise: false }).cat2100 - world.anchors.cat2100) < 1e-12);
  const worse = { ...base, rubric: { ...flat, lossOfControl: 3 } };
  const up = stepAnchors(worse, { noise: false }).cat2100;
  assert.ok(up > world.anchors.cat2100);
  // Same rubric again from the moved anchors: the same level.
  assert.ok(Math.abs(stepAnchors({ ...worse, from: stepAnchors(worse) }, { noise: false }).cat2100 - up) < 1e-12);
  // Clipped to +-0.75 logit.
  const huge = stepAnchors({ ...base, rubric: { lossOfControl: 3, misuse: 3, oversight: 0, racePressure: 3 }, baseline: { lossOfControl: 0, misuse: 0, oversight: 3, racePressure: 0 } }, { noise: false });
  assert.ok(Math.abs(Math.log(huge.cat2100 / (1 - huge.cat2100)) - Math.log(world.anchors.cat2100 / (1 - world.anchors.cat2100)) - 0.75) < 1e-9);
});

test("event counts at the real rate give zero push", () => {
  const atRate: ReturnType<typeof ev>[] = [];
  for (const t of RULE_TYPES) for (let i = 0; i < Math.round(REAL_RATE[t]); i++) atRate.push(ev(t));
  // 1.7 rounds to 2, so check the exact algebra instead of rounding: push is linear in (count - rate).
  const p = whenPush([...atRate, ...atRate.slice(0, 0)]);
  assert.ok(Math.abs(p.asi2030 - 0.08 * (2 - 1.7)) < 1e-12);
  assert.deepEqual(whenPush([]).asi2030 < 0, true, "no events at all push toward later");
  // Exactly the rate for the integer types, and agentic incidents cancel the others only by their own term.
  const intRate = [ev("act-accelerating"), ev("act-accelerating"), ev("act-accelerating"), ev("act-restricting"), ev("act-restricting"), ev("lab-pause")];
  const q = whenPush(intRate);
  assert.ok(Math.abs(q.asi2030 - 0.08 * -1.7) < 1e-12, "only the agentic term remains");
});

test("counts are capped at 3, and only major incidents and binding acts count", () => {
  assert.deepEqual(ruleCounts([ev("act-accelerating", false), ev("lab-incident-agentic", true, "minor"), ev("soft"), ev("other")]), { "lab-incident-agentic": 0, "act-accelerating": 0, "act-restricting": 0, "lab-pause": 0 });
  const five = Array.from({ length: 5 }, () => ev("lab-incident-agentic"));
  assert.equal(whenPush(five).asi2030, whenPush(five.slice(0, 3)).asi2030);
});

test("per-event effects sum to the type's centred push", () => {
  // Every type present, so no type's centred term is left without an event to carry it.
  const es = [ev("lab-incident-agentic"), ev("lab-incident-agentic"), ev("lab-pause"), ev("act-accelerating"), ev("act-restricting"), ev("soft")];
  const fx = eventEffects(es);
  assert.equal(fx[5], null);
  const sum = fx.reduce((s, f) => s + (f?.dlogit.asi2030 ?? 0), 0);
  assert.ok(Math.abs(sum - whenPush(es).asi2030) < 1e-12);
  assert.ok(fx.every((f) => f === null || f.rule === "GAME RULE"));
});

test("rules off keeps the noise; decay only moves asi2030 down and holds the rest", () => {
  const events = [ev("lab-incident-agentic"), ev("lab-incident-agentic"), ev("lab-incident-agentic")];
  const on = stepAnchors({ ...base, events });
  const off = stepAnchors({ ...base, events }, { nudges: false, rubric: false });
  const decay = stepAnchors({ ...base, events }, { nudges: false, rubric: false, noise: false });
  assert.notDeepEqual(on, off);
  assert.ok(decay.asi2030 < world.anchors.asi2030);
  assert.deepEqual([decay.asi2040, decay.asi2100, decay.cat2100].map((x) => +x.toFixed(9)), [world.anchors.asi2040, world.anchors.asi2100, world.anchors.cat2100].map((x) => +x.toFixed(9)));
  // The rules-off and decay lines differ by the noise only, on the "when" anchors.
  assert.notEqual(off.asi2030, decay.asi2030);
});

test("the rule sum is clipped, and asi2030 decays to ~0 by 2030.0 without throwing", () => {
  const many = Array.from({ length: 3 }, () => ev("lab-pause"));
  const clipped = stepAnchors({ ...base, events: many }, { noise: false, rubric: false });
  const logit = (p: number) => Math.log(p / (1 - p));
  const decayed = stepAnchors(base, { nudges: false, rubric: false, noise: false }).asi2030;
  assert.ok(Math.abs(logit(clipped.asi2030) - logit(decayed)) <= 0.63 + 1e-9);
  let a = base.from;
  const edges = ["2027-01-01", "2027-07-01", "2028-01-01", "2028-07-01", "2029-01-01", "2029-07-01", "2030-01-01", "2030-07-01", "2031-01-01"].map((d) => d + "T00:00:00Z");
  for (let s = 0; s < 8; s++) {
    a = stepAnchors({ ...base, from: a, start: edges[s], end: edges[s + 1], step: s + 1 });
    assert.ok(Object.values(a).every((p) => p >= 0 && p <= 1 && Number.isFinite(p)), `step ${s + 1}`);
    assert.doesNotThrow(() => readClock({ ...world, asOf: edges[s + 1], anchors: a }), edges[s + 1]);
  }
  assert.ok(a.asi2030 < 0.01);
});

test("the clock reads after 2030.0 (the resolved knot is dropped)", () => {
  const c = readClock({ ...world, asOf: "2030-03-01T00:00:00Z" });
  assert.ok(c.date10 !== null && c.date10 > "2030-03");
});

// A saved recording reproduces step by step: each step's anchors come from the previous step's, its events
// and rubric, by stepAnchors. Runs on public/cache/futures.json once the recorder has written it.
function reproduce(f: RecordedFuture) {
  let from = f.startAnchors;
  for (const s of f.steps) {
    const args: StepArgs = { from, today: f.startAnchors, start: s.start, end: s.end, events: s.events, rubric: s.rubric, baseline: f.baselineRef, future: f.id, step: s.step };
    const got = stepAnchors(args);
    for (const k of Object.keys(got) as (keyof Anchors)[]) assert.ok(Math.abs(got[k] - s.anchors[k]) < 5e-4, `future ${f.id} step ${s.step} ${k}: ${got[k]} vs ${s.anchors[k]}`);
    from = s.anchors; // the saved value, so one rounded step cannot drift into the next
  }
}

test("a saved recording is reproduced step by step", (t) => {
  const url = new URL("../../public/cache/futures.json", import.meta.url);
  if (!existsSync(url)) return t.skip("no recording yet (public/cache/futures.json)");
  const futures: RecordedFuture[] = JSON.parse(readFileSync(url, "utf8"));
  assert.ok(futures.length > 0);
  futures.forEach(reproduce);
});

test("a recording made with stepAnchors reproduces, and a tampered anchor does not", () => {
  const f: RecordedFuture = { schema: "doomclock.future/1", id: 2, seed: 2, startAnchors: world.anchors, baselineRef: flat, rulesVersion: "t", steps: [] };
  let from = f.startAnchors;
  const edges = ["2027-01-01", "2027-07-01", "2028-01-01", "2028-07-01"].map((d) => d + "T00:00:00Z");
  for (let i = 0; i < 3; i++) {
    const events = i === 1 ? [ev("lab-pause"), ev("act-restricting")] : [ev("lab-incident-agentic")];
    const rubric = { ...flat, lossOfControl: 1 + i };
    const anchors = stepAnchors({ from, today: f.startAnchors, start: edges[i], end: edges[i + 1], events, rubric, baseline: flat, future: 2, step: i + 1 });
    f.steps.push({ step: i + 1, start: edges[i], end: edges[i + 1], anchors, rubric, summary: "", expected: [], events: events as WorldEvent[], topPosts: [], date10: 0, rulesOffDate10: 0, noEventsDate10: 0, readoutOk: true, runId: "t", costUsd: 0, wallS: 0 });
    from = anchors;
  }
  assert.doesNotThrow(() => reproduce(f));
  f.steps[1].anchors = { ...f.steps[1].anchors, cat2100: f.steps[1].anchors.cat2100 + 0.01 };
  assert.throws(() => reproduce(f));
});
