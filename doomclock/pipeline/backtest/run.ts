// Scores the pool and writes data/backtest.json (and data/tests/t8-pilot.json for the pilot sample).
// Run: node doomclock/pipeline/backtest/run.ts   (after llm.ts; reads forecasts.jsonl, no API calls)
// Design and every rule it follows: docs/data/backtest.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";
import { MODEL, PROMPT_V, prompt, readForecasts, runOrder } from "./llm.ts";
import { EARLIEST_T, HORIZON_DAYS, MIN_TRADERS, MODEL_CUTOFF, SOURCES, loadPool, type Question } from "./pool.ts";
import { blend, bootstrapCI, brier, pickW, reliability, splitByDate } from "./score.ts";

const DATA = join(import.meta.dirname, "../../../data");
const W_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const r3 = (x: number) => Math.round(x * 1000) / 1000, r4 = (x: number) => Math.round(x * 10000) / 10000;
const iso = (t: number) => new Date(t).toISOString().replace(".000Z", "Z");

const { questions: pool, dropped } = loadPool();
const all = readForecasts();
const fc = new Map(all.filter((f) => f.v === PROMPT_V && f.model === MODEL).map((f) => [f.id, f]));
type Row = Question & { llm: number | null };
const rows: Row[] = pool.map((q) => ({ ...q, llm: fc.get(q.id)?.p ?? null }));
const asked = rows.filter((r) => fc.has(r.id));
const label = asked.length === rows.length ? "full" : "pilot";

// Pilot runs score only the questions the model was asked; the full run scores the whole pool.
const scored = label === "full" ? rows : asked;
const { train, test, gap, cut } = splitByDate(scored);

// Fitted on train only: the base rate (per source) and w.
const baseRate = Object.fromEntries(SOURCES.map((s) => {
  const tr = train.filter((r) => r.source === s);
  return [s, tr.length ? tr.reduce((a, r) => a + r.y, 0) / tr.length : 0.5];
})) as Record<string, number>;
const trL = train.filter((r) => r.llm != null);
const wPick = pickW(trL.map((r) => r.market.p), trL.map((r) => r.llm!), trL.map((r) => r.y), W_GRID);
const w = wPick.w;

// Forecasters, applied to test rows. No forecast from the model (bad JSON) means no nudge: blend = market.
const F = {
  market: (r: Row) => r.market.p,
  coin: () => 0.5,
  baseRate: (r: Row) => baseRate[r.source],
  blindLlm: (r: Row) => r.llm,
  blend: (r: Row) => (r.llm == null ? r.market.p : blend(r.market.p, r.llm, w)),
};
type Name = keyof typeof F;

function score(rs: Row[], name: Name, seed = 1) {
  const ok = rs.filter((r) => F[name](r) != null);
  if (!ok.length) return null;
  const p = ok.map((r) => F[name](r)!), y = ok.map((r) => r.y);
  const ci = bootstrapCI(ok.map((r) => r.group), (idx) => brier(idx.map((i) => p[i]), idx.map((i) => y[i])), 2000, seed);
  return { brier: r4(brier(p, y)), ci95: [r4(ci[0]), r4(ci[1])] as [number, number], n: ok.length };
}
function diff(rs: Row[], a: Name, b: Name) {
  const ok = rs.filter((r) => F[a](r) != null && F[b](r) != null);
  const d = ok.map((r) => (F[a](r)! - r.y) ** 2 - (F[b](r)! - r.y) ** 2);
  const mean = (idx: number[]) => idx.reduce((s, i) => s + d[i], 0) / idx.length;
  const ci = bootstrapCI(ok.map((r) => r.group), mean, 2000, 2);
  return { a, b, delta: r4(mean(d.map((_, i) => i))), ci95: [r4(ci[0]), r4(ci[1])] as [number, number], n: ok.length };
}

const scores = Object.fromEntries((Object.keys(F) as Name[]).map((k) => [k, score(test, k)])) as Record<Name, ReturnType<typeof score>>;
const pairedDiffs = [diff(test, "market", "coin"), diff(test, "market", "baseRate"), diff(test, "blindLlm", "market"), diff(test, "blend", "market")];
const bySource = Object.fromEntries(SOURCES.map((s) => {
  const rs = test.filter((r) => r.source === s);
  return [s, { n: rs.length, yesShare: r3(rs.reduce((a, r) => a + r.y, 0) / Math.max(1, rs.length)), market: score(rs, "market"), coin: score(rs, "coin"), baseRate: score(rs, "baseRate"), blindLlm: score(rs, "blindLlm") }];
}));
const rel = (name: Name) => { const ok = test.filter((r) => F[name](r) != null); return reliability(ok.map((r) => F[name](r)!), ok.map((r) => r.y)).map((b) => ({ ...b, meanForecast: r3(b.meanForecast), observed: r3(b.observed) })); };

// Leakage checks, each computed from the data, not asserted by hand.
function rawPromptCheck() {
  let checked = 0, bad = 0;
  for (const r of asked) {
    const f = fc.get(r.id)!, path = join(RAW, f.raw.replace(/^data\/raw\//, ""));
    if (!existsSync(path)) continue;
    checked++;
    const sent = JSON.parse(readFileSync(path, "utf8")).request.messages;
    if (JSON.stringify(sent) !== JSON.stringify(prompt(r.question, r.T))) bad++;
  }
  return { checked, bad };
}
const rp = rawPromptCheck();
const checks = [
  { name: "Every market price used is from before its forecast date", passed: scored.every((r) => Date.parse(r.market.ts) < r.t), detail: `${scored.length} prices checked` },
  { name: "Every forecast date is 30 days before the question resolved", passed: scored.every((r) => r.resolved - r.t === HORIZON_DAYS * 86_400_000), detail: "T = resolution − 30 days, the same rule for every question" },
  { name: "Every forecast date is at least a month after the model's training cutoff", passed: scored.every((r) => r.t >= Date.parse(EARLIEST_T)), detail: `cutoff ${MODEL_CUTOFF}, earliest T ${EARLIEST_T.slice(0, 10)}` },
  { name: "Every training question resolved before the first test forecast", passed: Math.max(...train.map((r) => r.resolved)) < Math.min(...test.map((r) => r.t)), detail: `cut ${iso(cut).slice(0, 10)}; ${gap} questions in between are used by neither half` },
  { name: "The model saw only the question text and the date", passed: rp.bad === 0 && rp.checked > 0, detail: `${rp.checked} saved requests compared with the prompt builder, ${rp.bad} differ` },
];
const passed = checks.every((c) => c.passed);
if (!passed) console.error("LEAKAGE CHECK FAILED", checks.filter((c) => !c.passed));

const cost = all.reduce((s, f) => s + f.cost, 0);
const parsed = asked.filter((r) => r.llm != null).length;
const m = scores.market!, c = scores.coin!, b = scores.baseRate!, bl = scores.blend!;
const blendDiff = pairedDiffs[3];
const fmt = (x: number) => x.toFixed(3);
const headline = `${HORIZON_DAYS} days before they resolved, market prices scored ${fmt(m.brier)} on ${test.length.toLocaleString("en-GB")} later AI questions. A 50% coin scores ${fmt(c.brier)} and the base rate ${fmt(b.brier)}. Lower is better.`;
const wText = w === 0
  ? "Mixing in a blind AI model's guess did not help on the earlier questions, so the weight is 0 and the clock uses market prices alone."
  : `On the earlier questions the best mix was ${Math.round(w * 100)}% of the blind AI model's guess. On the later questions that mix scored ${fmt(bl.brier)} against ${fmt(m.brier)} for the market alone (difference ${blendDiff.delta > 0 ? "+" : ""}${blendDiff.delta.toFixed(4)}, 95% CI ${blendDiff.ci95[0].toFixed(4)} to ${blendDiff.ci95[1].toFixed(4)}).`;

const out = {
  schema: "doomclock.backtest/1",
  label,
  generatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  model: { id: MODEL, trainingCutoff: MODEL_CUTOFF, earliestT: EARLIEST_T, promptVersion: PROMPT_V },
  design: { horizonDays: HORIZON_DAYS, minTradersManifold: MIN_TRADERS, wGrid: W_GRID, bootstrap: "2,000 resamples of whole events (a Polymarket event or Kalshi ladder is one cluster)", baseRate: Object.fromEntries(Object.entries(baseRate).map(([k, v]) => [k, r3(v)])) },
  split: iso(cut),
  n: { pool: pool.length, scored: scored.length, train: train.length, test: test.length, gap, events: new Set(test.map((r) => r.group)).size, bySource: Object.fromEntries(SOURCES.map((s) => [s, { pool: pool.filter((r) => r.source === s).length, test: test.filter((r) => r.source === s).length }])), dropped },
  llm: { asked: asked.length, parsed, parseRate: r4(parsed / Math.max(1, asked.length)) },
  scores: { test: { ...scores, panel: null }, bySource },
  pairedDiffs,
  wChosen: w,
  w: { chosen: w, trainScores: wPick.scores.map((s) => ({ w: s.w, brier: r4(s.brier) })), trainN: trL.length, test: { blend: scores.blend, market: scores.market, diff: blendDiff }, text: wText },
  reliability: rel("market"),
  reliabilityLlm: rel("blindLlm"),
  headline: { text: headline },
  leakage: { canary: { passed, note: `${checks.filter((c) => c.passed).length} of ${checks.length} leakage checks passed` }, checks },
  cost: { usd: r4(cost), calls: all.length, note: "OpenRouter usage.cost summed over every call, including the 40-call v1 pilot" },
  caveats: [
    "Only questions that have resolved YES or NO are scored. Open, cancelled and N/A questions are left out, so the pool is not every AI question that was asked.",
    "T is set from each question's resolution date. A question that resolved early (often a YES) is forecast 30 days before that early date, so this measures accuracy 30 days out.",
    "Manifold uses play money, so its prices are noisier. We keep only Manifold questions with at least 20 traders. Kalshi and Polymarket are real money but some markets are thin.",
    "Many Polymarket and Kalshi questions are rungs of one ladder or candidates in one event. The confidence intervals resample whole events, so they are wider than a naive count suggests.",
    "The blind model is google/gemini-2.5-flash with a training cutoff of 31 Jan 2025. It is not deterministic even at temperature 0.",
    "This scores market prices and the model's nudges on resolved questions. The countdown date itself cannot be scored, and is not.",
  ],
};
writeFileSync(join(DATA, "backtest.json"), JSON.stringify(out, null, 1) + "\n");
console.log(headline, "\n", wText, "\n", JSON.stringify({ label, n: out.n, llm: out.llm, cost: out.cost.usd, leakage: out.leakage.canary }));

// T8 pilot record: the first 40 questions of the seeded run order (the pilot sample).
const pilotIds = new Set(runOrder(pool).slice(0, 40).map((q) => q.id));
const pilot = all.filter((f) => pilotIds.has(f.id));
const pv = (v: number | undefined) => pilot.filter((f) => (f.v ?? 1) === v);
mkdirSync(join(DATA, "tests"), { recursive: true });
writeFileSync(join(DATA, "tests", "t8-pilot.json"), JSON.stringify({
  schema: "doomclock.t8-pilot/1", model: MODEL, trainingCutoff: MODEL_CUTOFF, earliestT: EARLIEST_T, eligible: pool.length,
  runs: [1, 2].map((v) => { const r = pv(v); const ok = r.filter((f) => f.p != null).length; return { promptVersion: v, n: r.length, parsed: ok, parseRate: r4(ok / Math.max(1, r.length)), costUsd: r4(r.reduce((s, f) => s + f.cost, 0)) }; }),
  extrapolatedFullCostUsd: r4((pv(2).reduce((s, f) => s + f.cost, 0) / Math.max(1, pv(2).length)) * pool.length),
  leakageChecksPassed: passed,
  note: "v1 let the model refuse (5 of 40 gave no number); v2 forces the JSON shape and is the version scored. Prompt changes were judged on parse rate only, never on accuracy.",
}, null, 1) + "\n");
