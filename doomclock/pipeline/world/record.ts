// Tasks 11 -> 150: the coupled loop recorder. For each future (seeds 1-3) and each of 6 steps of
// 6 months from 2027-01-01: write the 32 personas (WORLD SO FAR, MARKETS NOW, WHAT PEOPLE EXPECT
// NEXT), run one Twitter-only MiroFish round-trip, read events out of the posts, score the
// rubric, move the odds with engine/step.ts, read the clock, write the situation report, and
// checkpoint. Spec: docs/superpowers/specs/2026-10-25-doom-clock-coupled-loop-design.md (the
// Amendments win). Simulated content is labelled SIMULATED; every effect size is a GAME RULE.
// Outputs: data/world/baseline.json, data/world/futures/<id>.json (+ <id>/step-<s>/ with
// everything MiroFish produced), doomclock/web/public/cache/futures.json.
// Usage: node doomclock/pipeline/world/record.ts [--dry] [--baseline] [--future=1] [--steps=6] [--bundle]
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { BASE, closeEnv, SIM_ROOT, sleep, start, waitForEnd, call } from "../mirofish/api.ts";
import { guard, keyInfo, logCost } from "../mirofish/budget.ts";
import { eventEffects, msToYear, ruleCounts, REAL_RATE, stepAnchors, type Anchors } from "../../web/src/engine/step.ts";
import { asiKnots, p10Year, yearToIso, type SimInput } from "../../web/src/engine/sim.ts";
import { agentConfigs, loopCast, MAX_ROUNDS, profilesCsv, TIME_CONFIG, type Cast, type Memory } from "../../web/src/game/cast.ts";
import type { RecordedFuture, RecordedStep, Rubric, World, WorldEvent } from "../../web/src/contracts.ts";
import { formatPeriod, kindOf, realPeriod, DAY } from "./format.ts";
import { eligible, readOut, realIdentifiers, type Post } from "./readout.ts";
import { scoreRubric, summarise, type Expectation } from "./report.ts";
import { READOUT_MODEL } from "./llm.ts";

const ROOT = join(import.meta.dirname, "../../..");
const WORLD_DIR = join(ROOT, "data/world");
const FUTURES = join(WORLD_DIR, "futures");
const BUNDLE = join(ROOT, "doomclock/web/public/cache/futures.json");
const RAW_MIRO = join(process.env.HOME ?? "", "dev/oxhack/data/raw/mirofish");
const PROJECT = { project_id: "proj_69d072e0c890", graph_id: "mirofish_9df0589c36e0491b" };
const MODEL = "deepseek/deepseek-v4.1-flash-1017";
export const RULES_VERSION = "coupled-loop/1 (25 Oct 2026)";
const STEPS = 6;
const T0 = Date.parse("2027-01-01T00:00:00Z");
const MARKETS = 26;

const rawCast = JSON.parse(readFileSync(join(ROOT, "doomclock/web/src/game/data/cast.json"), "utf8")) as Cast;
const cast = loopCast(rawCast);
const world = JSON.parse(readFileSync(join(ROOT, "doomclock/web/public/cache/world.json"), "utf8")) as World;
const realEvents = (JSON.parse(readFileSync(join(ROOT, "data/events.json"), "utf8")).events ?? []) as WorldEvent[];
const REAL_IDS = realIdentifiers([...realEvents.flatMap((e) => [e.title, e.detail ?? ""]), ...rawCast.accounts.flatMap((a) => a.facts.map((f) => f.text))]);

const jsonOut = (f: string, v: unknown) => { mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };
const stepStart = (s: number) => new Date(Date.UTC(2027, 6 * (s - 1), 1)).toISOString().replace(".000Z", "Z");
const period = (s: number) => `${new Date(stepStart(s)).getUTCFullYear()} ${s % 2 ? "H1" : "H2"}`;
const ymd = (ts: string) => ts.slice(0, 10);

// ---------- the clock ----------

/** The 1-in-10 date (decimal year) for these anchors read at `at`; same as engine/timeline.ts simInput + p10Year. */
export function date10Year(a: Anchors, at: number, lag = world.lagMeanYears): number {
  const input: SimInput = {
    startYear: at,
    asi: [{ year: 2030, p: a.asi2030 }, { year: 2040, p: a.asi2040 }, { year: 2100, p: a.asi2100 }].filter((k) => k.year > at),
    pCat2100: a.cat2100, lagMeanYears: lag,
  };
  void asiKnots;
  return +(p10Year(input) ?? 2100).toFixed(2);
}
const month = (y: number) => new Date(yearToIso(y)).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const pct = (p: number, d = 0) => `${(p * 100).toFixed(d)}%`;

/** MARKETS NOW: current anchors and their change since the last step, the clock, and the summary. */
export function marketsLine(a: Anchors, prev: Anchors | null, date10: number, summary: string): string {
  const d = (k: keyof Anchors, dp = 0) => (prev ? ` (${a[k] >= prev[k] ? "+" : "-"}${Math.abs((a[k] - prev[k]) * 100).toFixed(dp === 0 ? 0 : dp)} pts)` : "");
  const base = `P(powerful AI by 2030) ${pct(a.asi2030)}${d("asi2030")}; by 2040 ${pct(a.asi2040)}${d("asi2040")}; by 2100 ${pct(a.asi2100)}. P(AI catastrophe by 2100) ${pct(a.cat2100, 1)}${d("cat2100", 1)}. The clock's 1-in-10 date: ${month(date10)}. Simulated odds, moved by rules, not live prices.`;
  return summary ? `${base} Last period: ${summary.slice(0, 240)}` : base;
}

// ---------- the baseline ----------

export interface Baseline { asOf: string; model: string; rubric: Rubric; cites: Record<string, string[]>; citedEvents: Record<string, { ts: string; title: string; url?: string }>; incidents: number; samples: Rubric[]; noise: Rubric; mean: Rubric; parityOk: boolean; formatted: string }

async function baseline(): Promise<Baseline> {
  const { events, incidents } = realPeriod(realEvents, world.asOf);
  const f = formatPeriod(events, incidents);
  const zero: Rubric = { lossOfControl: 0, misuse: 0, oversight: 0, racePressure: 0 };
  const main = await scoreRubric("baseline", f.text, zero, { temperature: 0, clamp: false });
  if (!main.ok) throw new Error("baseline: rubric call failed");
  const samples: Rubric[] = [];
  for (let i = 0; i < 5; i++) { const s = await scoreRubric(`baseline-n${i}`, f.text, zero, { temperature: 0.7, clamp: false }); if (s.ok) samples.push(s.rubric); }
  const keys = Object.keys(zero) as (keyof Rubric)[];
  const mean = { ...zero }, noise = { ...zero };
  for (const k of keys) {
    mean[k] = +(samples.reduce((s, r) => s + r[k], 0) / Math.max(1, samples.length)).toFixed(2);
    noise[k] = +Math.sqrt(samples.reduce((s, r) => s + (r[k] - mean[k]) ** 2, 0) / Math.max(1, samples.length)).toFixed(2);
  }
  const cited: Baseline["citedEvents"] = {};
  for (const ids of Object.values(main.cites)) for (const id of ids) if (f.ids[id]) cited[id] = { ts: f.ids[id].ts, title: f.ids[id].title, url: f.ids[id].url };
  const out: Baseline = { asOf: world.asOf, model: READOUT_MODEL, rubric: main.rubric, cites: main.cites, citedEvents: cited, incidents, samples, noise, mean, parityOk: keys.every((k) => Math.abs(mean[k] - main.rubric[k]) <= 0.5), formatted: f.text };
  jsonOut(join(WORLD_DIR, "baseline.json"), out);
  return out;
}
const loadBaseline = (): Baseline => JSON.parse(readFileSync(join(WORLD_DIR, "baseline.json"), "utf8"));

// ---------- memory for one step ----------

const worldLine = (e: WorldEvent) => `[${ymd(e.ts)}] ${e.who ? e.who + ": " : ""}${e.title}`;
const expectLine = (x: Expectation) => `${x.who} may ${x.what}`.replace(/\s+/g, " ").slice(0, 118).replace(/[.\s]*$/, ".");

interface Carry { events: WorldEvent[]; summary: string; expected: Expectation[]; anchors: Anchors; prevAnchors: Anchors | null; date10: number; topPosts: Post[] }

export function memoryFor(s: number, c: Carry): Memory {
  const real = realEvents.filter((e) => e.provenance === "real" && e.major && Date.parse(e.ts) < Date.parse(world.asOf)).slice(-6);
  const decisions: Record<number, string[]> = {};
  for (const e of c.events) if (e.actorId !== undefined) (decisions[e.actorId] ??= []).push(`[${ymd(e.ts)}] You announced: ${e.title}`.slice(0, 160));
  return {
    quarter: period(s),
    world: [...real.map(worldLine), ...c.events.map(worldLine)],
    markets: marketsLine(c.anchors, c.prevAnchors, c.date10, c.summary),
    expected: c.expected.map(expectLine),
    decisions,
  };
}

// ---------- one MiroFish run ----------

function readDb(simDir: string, seedText: Map<string, string>): { posts: Post[]; edges: unknown[] } {
  const db = new DatabaseSync(join(simDir, "twitter_simulation.db"), { readOnly: true });
  const rows = db.prepare("select post_id, user_id, original_post_id, content, quote_content, created_at, num_likes, num_shares from post order by post_id").all() as any[];
  db.close();
  return { posts: rows.map((r) => ({
    id: r.post_id, uid: r.user_id, round: Number(r.created_at) || 0, text: r.content ?? "", quote: r.quote_content ?? null, original: r.original_post_id ?? null,
    likes: r.num_likes ?? 0, shares: r.num_shares ?? 0, ...(seedText.has(r.content) && !r.original_post_id ? { seed: seedText.get(r.content) } : {}),
  })), edges: [] };
}

async function ensureSim(): Promise<string> {
  const f = join(WORLD_DIR, "sim.json");
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")).simulation_id;
  const d = await call("POST", "/api/simulation/create", { ...PROJECT, enable_twitter: true, enable_reddit: false });
  jsonOut(f, { simulation_id: d.simulation_id, created_at: d.created_at, ...PROJECT });
  return d.simulation_id;
}

function writeSimFiles(sim: string, mem: Memory, seeds: { uid: number; kind: string; text: string }[]) {
  const dir = join(SIM_ROOT, sim);
  writeFileSync(join(dir, "twitter_profiles.csv"), profilesCsv(cast, mem));
  const config = {
    simulation_id: sim, ...PROJECT,
    simulation_requirement: `Doom Clock recorded run: how the 32 accounts react in ${mem.quarter}.`,
    time_config: TIME_CONFIG, agent_configs: agentConfigs(cast, mem),
    event_config: { initial_posts: seeds.map((s) => ({ poster_agent_id: s.uid, poster_type: s.kind, content: s.text })), scheduled_events: [], hot_topics: [], narrative_direction: "" },
    twitter_config: { platform: "twitter", recency_weight: 0.4, popularity_weight: 0.3, relevance_weight: 0.3, viral_threshold: 10, echo_chamber_strength: 0.5 },
    reddit_config: null, llm_model: MODEL, llm_base_url: "https://openrouter.ai/api/v1",
    generated_at: new Date().toISOString(), generation_reasoning: "Written by doomclock/pipeline/world/record.ts from cast.json (no /prepare, no Zep).",
  };
  writeFileSync(join(dir, "simulation_config.json"), JSON.stringify(config, null, 2));
  const stateFile = join(dir, "state.json");
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  if (state.status === "created") Object.assign(state, { status: "ready" });
  Object.assign(state, { enable_twitter: true, enable_reddit: false, profiles_generated: true, config_generated: true, entities_count: 32, profiles_count: 32, entity_types: [...new Set(cast.accounts.map((a) => a.group))] });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/** Everything MiroFish produced, for a later replica of its own views: files and API responses. */
async function saveArtifacts(sim: string, dir: string) {
  mkdirSync(dir, { recursive: true });
  const src = join(SIM_ROOT, sim);
  for (const [from, to] of [["simulation_config.json", "simulation_config.json"], ["twitter_profiles.csv", "twitter_profiles.csv"], ["twitter/actions.jsonl", "actions.jsonl"], ["run_state.json", "run_state.json"], ["state.json", "state.json"], ["simulation.log", "simulation.log"]] as const)
    if (existsSync(join(src, from))) copyFileSync(join(src, from), join(dir, to));
  writeFileSync(join(dir, "twitter_simulation.db.gz"), gzipSync(readFileSync(join(src, "twitter_simulation.db"))));
  const api: Record<string, string> = {
    "run-status": `/api/simulation/${sim}/run-status`, "run-status-detail": `/api/simulation/${sim}/run-status/detail?platform=twitter`,
    actions: `/api/simulation/${sim}/actions?limit=2000`, timeline: `/api/simulation/${sim}/timeline`, "agent-stats": `/api/simulation/${sim}/agent-stats`,
    posts: `/api/simulation/${sim}/posts?platform=twitter&limit=1000`, profiles: `/api/simulation/${sim}/profiles?platform=twitter`, config: `/api/simulation/${sim}/config`,
  };
  const res: Record<string, string> = {};
  for (const [k, p] of Object.entries(api)) {
    try { const r = await fetch(BASE + p); writeFileSync(join(dir, `api-${k}.json`), await r.text()); res[k] = String(r.status); }
    catch (e) { res[k] = `error ${String(e).slice(0, 60)}`; }
  }
  jsonOut(join(dir, "artifacts.json"), { simulation_id: sim, savedAt: new Date().toISOString(), api: res, note: "twitter_simulation.db.gz is the gzipped sqlite DB of this run." });
}

async function ensureIdle(sim: string) {
  const s: any = await call("GET", `/api/simulation/${sim}/run-status`).catch(() => ({}));
  if (s.runner_status === "running" || s.runner_status === "starting") throw new Error(`run-status says ${sim} is ${s.runner_status}; not starting a second run`);
}

// ---------- one step ----------

interface StepWork { seenKeys: string[]; off: Anchors; none: Anchors; expected: Expectation[]; topPosts: Post[]; rejected: unknown[]; counts: Record<string, number>; cites: Record<string, string[]>; rubricOk: boolean; summaryOk: boolean; ruleCounts: Record<string, number>; realRate: typeof REAL_RATE; unexpected: number; hits: string[]; llmCost: number }

async function recordStep(sim: string, f: { id: number }, s: number, prev: { step: RecordedStep; work: StepWork } | null, startAnchors: Anchors, base: Baseline, allEvents: WorldEvent[]) {
  const label = `f${f.id} s${s}`;
  const dir = join(FUTURES, String(f.id), `step-${s}`);
  const t0 = Date.now();
  const startIso = stepStart(s), endIso = stepStart(s + 1);
  const from = prev?.step.anchors ?? startAnchors;
  const carry: Carry = {
    events: allEvents, summary: prev?.step.summary ?? "", expected: prev?.work.expected ?? [], anchors: from, prevAnchors: prev ? (prev.work as any).fromAnchors ?? null : null,
    date10: prev?.step.date10 ?? date10Year(startAnchors, msToYear(T0)), topPosts: prev?.work.topPosts ?? [],
  };
  const mem = memoryFor(s, carry);
  // Seeds: the Markets desk post and the previous step's top 3 posts, one per account.
  const seeds: { uid: number; kind: string; text: string }[] = [{ uid: MARKETS, kind: "markets", text: `[Markets desk · ${period(s)}] ${mem.markets}` }];
  const used = new Set([MARKETS]);
  for (const p of carry.topPosts) if (!used.has(p.uid) && cast.accounts[p.uid]?.activity > 0) { used.add(p.uid); seeds.push({ uid: p.uid, kind: "carry_over", text: ((p.original ? p.quote : p.text) ?? "").slice(0, 600) }); }

  await ensureIdle(sim);
  const u0 = await guard(`${label}`);
  writeSimFiles(sim, mem, seeds);
  const ts = Date.now();
  await start(sim, MAX_ROUNDS, true);
  await waitForEnd(sim, ts - 1000, 600_000);
  await closeEnv(sim).catch(() => null);
  const runS = (Date.now() - ts) / 1000;
  const { posts } = readDb(join(SIM_ROOT, sim), new Map(seeds.map((x) => [x.text, x.kind])));
  await saveArtifacts(sim, dir);
  await sleep(6000);
  const runCost = +((await keyInfo()).usage - u0).toFixed(6);
  logCost({ event: "run", label, sim, cost_usd: runCost, wall_s: +runS.toFixed(1) });

  // Read out events, then score the rubric from event objects only.
  const ro = await readOut({ cast, posts, futureId: f.id, step: s, start: startIso, end: endIso, seenKeys: prev?.work.seenKeys ?? [], realIds: REAL_IDS });
  let rubric = prev?.step.rubric ?? base.rubric, cites: Record<string, string[]> = {}, rubricOk = false, llm = ro.cost;
  if (ro.ok) {
    const fmt = formatPeriod(ro.events, base.incidents);
    const sc = await scoreRubric(label, fmt.text, rubric);
    rubric = sc.rubric; cites = sc.cites; rubricOk = sc.ok; llm += sc.cost;
  }
  // Move the odds: the full line, the same noise with rules off, and decay only.
  const args = { today: startAnchors, start: startIso, end: endIso, events: ro.events, rubric, baseline: base.rubric, future: f.id, step: s };
  const anchors = stepAnchors({ ...args, from }, {});
  const off = stepAnchors({ ...args, from: prev?.work.off ?? startAnchors }, { nudges: false, rubric: false });
  const none = stepAnchors({ ...args, from: prev?.work.none ?? startAnchors }, { nudges: false, rubric: false, noise: false });
  const at = msToYear(Date.parse(endIso));
  const [date10, rulesOffDate10, noEventsDate10] = [date10Year(anchors, at), date10Year(off, at), date10Year(none, at)];

  // Top posts, summary, and what people expect next.
  const eligiblePosts = eligible(posts);
  const top = [...eligiblePosts].sort((a, b) => b.likes + b.shares - (a.likes + a.shares) || a.id - b.id).filter((p, i, arr) => arr.findIndex((q) => q.uid === p.uid) === i).slice(0, 3);
  const facts = `clock ${month(date10)} (was ${month(carry.date10)}); P(powerful AI by 2030) ${pct(anchors.asi2030)}; P(AI catastrophe by 2100) ${pct(anchors.cat2100, 1)}; rubric ${JSON.stringify(rubric)}; ${ro.events.length} events`;
  const fmt = formatPeriod(ro.events, base.incidents);
  const rep = ro.ok ? await summarise(label, fmt.text, top.map((p) => `[${cast.accounts[p.uid].name}] ${p.own.slice(0, 240)}`), facts) : { summary: "", expected: [] as Expectation[], cost: 0, ok: false };
  llm += rep.cost;

  // In-simulation hit rate: last step's expectations that an account with standing then posted.
  const hits = (prev?.work.expected ?? []).filter((x) => ro.events.some((e) => e.type === x.type && x.who.toLowerCase().split(/\W+/).some((w) => w.length > 2 && (e.who ?? "").toLowerCase().includes(w)))).map((x) => `${x.who}: ${x.what}`);
  const unexpected = ro.events.length - Math.min(hits.length, ro.events.length);

  const counts = ruleCounts(ro.events);
  console.log(`  ${label}: ${posts.filter((p) => !p.seed).length} new posts, ${ro.events.length} events (${ro.rejected.length} rejected), rubric ${Object.values(rubric).join("")}, date10 ${date10} (rules off ${rulesOffDate10}, no events ${noEventsDate10}), run $${runCost}, llm $${llm.toFixed(4)}, ${((Date.now() - t0) / 1000).toFixed(0)} s; simulated count vs real rate ${JSON.stringify(counts)} vs ${JSON.stringify(REAL_RATE)}`);

  const step: RecordedStep = {
    step: s, start: startIso, end: endIso, anchors, rubric, summary: rep.summary, expected: rep.expected.map((x) => `${x.who}: ${x.what} (${x.why})`),
    events: ro.events, topPosts: top.map((p) => ({ postId: p.id, actorId: p.uid, text: p.own.slice(0, 280) })),
    date10, rulesOffDate10, noEventsDate10, followThrough: hits.length, readoutOk: ro.ok, runId: `${sim}@${new Date(ts).toISOString().replace(/\.\d+Z$/, "Z")}`,
    costUsd: +(runCost + llm).toFixed(4), wallS: +((Date.now() - t0) / 1000).toFixed(1),
  };
  const work: StepWork & { fromAnchors: Anchors } = { seenKeys: [...(prev?.work.seenKeys ?? []), ...ro.keys], off, none, expected: rep.expected, topPosts: top, rejected: ro.rejected, counts: ro.counts, cites, rubricOk, summaryOk: rep.ok, ruleCounts: counts, realRate: REAL_RATE, unexpected: (prev?.work.unexpected ?? 0) + unexpected, hits, llmCost: llm, fromAnchors: from };
  jsonOut(join(dir, "step.json"), { step, work });
  return { step, work };
}

// ---------- a future ----------

async function recordFuture(sim: string, id: number, base: Baseline, steps: number) {
  const startAnchors = { ...world.anchors } as Anchors;
  const steps_: RecordedStep[] = [];
  let prev: { step: RecordedStep; work: StepWork } | null = null;
  const events: WorldEvent[] = [];
  for (let s = 1; s <= steps; s++) {
    const f = join(FUTURES, String(id), `step-${s}`, "step.json");
    if (existsSync(f)) { prev = JSON.parse(readFileSync(f, "utf8")); console.log(`  f${id} s${s}: already recorded`); }
    else prev = await recordStep(sim, { id }, s, prev, startAnchors, base, events);
    steps_.push(prev!.step); events.push(...prev!.step.events);
    const fut: RecordedFuture & { unexpected: number } = { schema: "doomclock.future/1", id, seed: id, startAnchors, baselineRef: base.rubric, rulesVersion: RULES_VERSION, steps: steps_, unexpected: (prev!.work as StepWork).unexpected };
    jsonOut(join(FUTURES, `${id}.json`), fut);
  }
}

function bundle() {
  const all: RecordedFuture[] = [1, 2, 3].map((i) => join(FUTURES, `${i}.json`)).filter(existsSync).map((f) => JSON.parse(readFileSync(f, "utf8")));
  writeFileSync(BUNDLE, JSON.stringify(all));
  console.log(`bundle: ${all.length} futures, ${all.map((f) => f.steps.length).join("/")} steps -> ${BUNDLE}`);
}

// ---------- --dry: render all 32 personas for a step-6 memory ----------

function dryMemory(): Memory {
  const fix = JSON.parse(readFileSync(join(ROOT, "doomclock/web/public/cache/futures.fixture.json"), "utf8"))[0] as RecordedFuture;
  const events = fix.steps.slice(0, 5).flatMap((x) => x.events).map((e) => ({ ...e, title: e.title.padEnd(110, " and so on"), who: e.who ?? "Global wire desk" }));
  const prev = fix.steps[4], last = fix.steps[5];
  const mem = memoryFor(6, {
    events, summary: "A lab paused a release after an agent incident, two governments tightened export rules, and the clock moved by a few weeks. ".padEnd(240, "x"),
    expected: Array.from({ length: 5 }, (_, i) => ({ who: ["The US Executive Branch", "The EU AI Office", "OpenAI", "China CAC", "Nvidia"][i], what: "announce a binding rule on frontier training runs, after the last period's incidents", why: "E1", type: "act-restricting" as const })),
    anchors: last.anchors, prevAnchors: prev.anchors, date10: last.date10, topPosts: [],
  });
  return mem;
}

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
if (import.meta.main) {
  if (process.argv.includes("--dry")) {
    const { userChar, roster } = await import("../../web/src/game/cast.ts");
    const r = roster(cast);
    const personas = cast.accounts.map((a) => userChar(cast, a, dryMemory(), r));
    const inst = personas.filter((_, i) => i <= 12);
    const events = (u: string) => (u.split("WORLD SO FAR:")[1]?.split("\n").filter((l) => l.startsWith("- [20")).length ?? 0);
    const res = {
      max: Math.max(...personas.map((x) => x.length)),
      bad: personas.filter((x) => x.length > 3000 || !x.includes("MARKETS NOW:") || !x.includes("WHAT PEOPLE EXPECT NEXT:")).length + inst.filter((x) => events(x) < 4).length,
    };
    const line = `${new Date().toISOString().slice(11, 16)} ${res.bad === 0 && personas.length === 32 ? "PASS" : "FAIL"}: recorder --dry rendered ${personas.length} personas, longest ${res.max} chars (limit 3000), ${res.bad} bad; MARKETS NOW and WHAT PEOPLE EXPECT NEXT present in all, labs and governments keep at least 4 events`;
    console.log(line);
    if (process.argv.includes("--print")) console.log(personas[0]);
    writeFileSync(join(process.env.HOME ?? "", "dev/oxhack/.tmp/lanes/recorder.status"), line + "\n");
    if (res.bad) process.exit(1);
  } else if (process.argv.includes("--baseline")) {
    const b = await baseline();
    console.log(JSON.stringify({ rubric: b.rubric, mean: b.mean, noise: b.noise, parityOk: b.parityOk, incidents: b.incidents }));
  } else if (process.argv.includes("--bundle")) bundle();
  else {
    const sim = await ensureSim();
    const base = loadBaseline();
    const ids = arg("future") ? [Number(arg("future"))] : [1, 2, 3];
    for (const id of ids) { console.log(`future ${id}`); await recordFuture(sim, id, base, Number(arg("steps") ?? STEPS)); if (id < 90) bundle(); }
  }
}
