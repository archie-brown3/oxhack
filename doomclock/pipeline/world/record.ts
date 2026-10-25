// Task 11: the recorded runs library for the Engine view. Three representative futures from the
// engine (Early / Typical / Late: percentiles 0.1 / 0.5 / 0.9 over all 10,000), four quarters
// each, one Twitter-only MiroFish run per quarter on the hand-written 32-account cast.
// Every run starts from an empty world, so each quarter is seeded with that future's events
// (issuer, document number and dates in the first line, or agents treat them as rumours) and
// the previous recorded quarter's top posts; WORLD SO FAR carries the dated story so far.
// Outputs, all labelled RECORDED: data/world/runs/<pick>-<quarter>.json, raw MiroFish outputs
// in data/raw/mirofish/, and the assembled doomclock/web/src/ui/engine/library.json.
// Usage: node doomclock/pipeline/world/record.ts [--only=early] [--dry] [--assemble]
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { actions, call, closeEnv, SIM_ROOT, sleep, start, waitForEnd } from "../mirofish/api.ts";
import { guard, keyInfo, logCost } from "../mirofish/budget.ts";
import { buildTimeline, PICKS } from "../../web/src/engine/index.ts";
import { agentConfigs, profilesCsv, TIME_CONFIG, MAX_ROUNDS, type Cast, type Memory } from "../../web/src/game/cast.ts";
import type { SampledFuture, World, WorldEvent, WorldFrame } from "../../web/src/contracts.ts";

const ROOT = join(import.meta.dirname, "../../..");
const RUNS = join(ROOT, "data/world/runs");
const RAW = join(process.env.HOME ?? "", "dev/oxhack/data/raw/mirofish"); // gitignored, main checkout
const LIBRARY = join(ROOT, "doomclock/web/src/ui/engine/library.json");
const PROJECT = { project_id: "proj_69d072e0c890", graph_id: "mirofish_9df0589c36e0491b" };
const MODEL = "deepseek/deepseek-v4.1-flash-1017";
const cast = JSON.parse(readFileSync(join(ROOT, "doomclock/web/src/game/data/cast.json"), "utf8")) as Cast;
const world = JSON.parse(readFileSync(join(ROOT, "doomclock/web/public/cache/world.json"), "utf8")) as World;

type PickName = keyof typeof PICKS;
export interface Seed { uid: number; kind: "government" | "news" | "incident" | "markets" | "milestone" | "carry_over"; text: string }

// ---------- which quarters ----------

const qOf = (iso: string) => { const d = new Date(iso); return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };

/** The first simulated quarter, the superintelligence and catastrophe quarters if this future has
 *  them, and evenly spaced quarters between, so a run shows the future's turning points. */
function chooseQuarters(frames: WorldFrame[], f: SampledFuture): number[] {
  const first = frames.findIndex((x) => x.provenance === "projected" && Date.parse(x.start) > Date.parse(world.asOf));
  const at = (iso: string | null) => (iso ? frames.findIndex((x) => x.quarter === qOf(iso)) : -1);
  const marks = [at(f.asiDate), at(f.catDate)].filter((k) => k > first);
  const last = marks.length ? Math.max(...marks) : frames.length - 1;
  const out = new Set([first, ...marks, last]);
  for (let i = 1; out.size < 4 && i < 8; i++) out.add(Math.round(first + ((last - first) * i) / 4));
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

// ---------- this future's events ----------

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const LAB = /\b(OpenAI|ChatGPT|Anthropic|Claude|Google|Gemini|DeepMind|Meta|Llama|xAI|Grok|DeepSeek|Alibaba|Qwen|Nvidia)\b/;
// AIID titles sometimes name private people; only organisation-only titles are used as templates.
const PERSON = /\b(Rep\.|Sen\.|Mr\.|Ms\.|Dr\.|Man|Woman|Teen|Boy|Girl|Mother|Father|Family|Student|Lawyer|Judge|Officer)\b|\b[A-Z][a-z]+ [A-Z][a-z]+'s\b/;

function incidentsFor(frame: WorldFrame) {
  const all = frame.events.filter((e) => e.provenance === "projected" && e.kind === "incident");
  const usable = all.filter((e) => LAB.test(e.title) && !PERSON.test(e.title));
  return { count: all.length, picked: usable.slice(0, 2) };
}

const LEVELS = [
  { US: "federal agencies must report any AI incident that touches a government system within 72 hours", UK: "AISI will run a pre-deployment evaluation of every new frontier model released in the UK", EU: "general-purpose model providers must publish incident logs every quarter", CN: "Chinese model providers must file each new frontier model with the CAC before release" },
  { US: "frontier developers must notify Commerce 30 days before any training run above 10^26 FLOP", UK: "frontier labs must give AISI access to model weights for testing before release", EU: "systemic-risk models must pass an AI Office evaluation before release in the EU", CN: "training runs above 10^26 FLOP in China need CAC approval" },
  { US: "training runs above 10^27 FLOP need a federal licence from Commerce", UK: "the UK will block the release of any model that fails an AISI cyber evaluation", EU: "the AI Office may order the withdrawal of a systemic-risk model within 48 hours", CN: "the CAC may suspend any model that shows uncontrolled behaviour" },
  { US: "an emergency 90-day pause on new training runs above 10^27 FLOP", UK: "an emergency suspension of frontier model deployment in the UK", EU: "an emergency suspension of systemic-risk models in the EU", CN: "an emergency suspension of frontier model training in China" },
];
const ISSUERS = [
  { uid: 8, key: "US" as const, name: "US Executive Branch", doc: (n: number, y: number) => `Executive Order ${14500 + (n % 400)}`, labs: [0, 1, 2, 3, 4] },
  { uid: 11, key: "UK" as const, name: "UK Government and AISI", doc: (n: number, y: number) => `AISI Notice ${y}-${String(10 + (n % 80)).padStart(2, "0")}`, labs: [0, 1, 2, 3, 4, 5, 6] },
  { uid: 10, key: "EU" as const, name: "EU AI Office", doc: (n: number, y: number) => `Commission Implementing Decision C(${y}) ${1000 + (n % 8999)}`, labs: [0, 1, 2, 3, 4, 5, 6] },
  { uid: 12, key: "CN" as const, name: "China CAC", doc: (n: number, y: number) => `CAC Order No. ${20 + (n % 70)} of ${y}`, labs: [5, 6] },
];

/** The seeded events for one quarter of one future. A template ladder (game rule) picks how
 *  strong the government measure is from the engine's capability curve and the milestones. */
function quarterEvents(fid: number, fi: number, qi: number, frame: WorldFrame, f: SampledFuture) {
  const start = Date.parse(frame.start);
  const h = hash(`${fid}:${frame.quarter}`);
  const y = new Date(start).getUTCFullYear();
  const isAsi = !!f.asiDate && qOf(f.asiDate) === frame.quarter;
  const isCat = !!f.catDate && qOf(f.catDate) === frame.quarter;
  const pastAsi = !!f.asiDate && Date.parse(f.asiDate) < start;
  const level = isCat ? 3 : Math.min(3, Math.floor(frame.capability * 3) + (isAsi || pastAsi ? 1 : 0));
  const issuer = ISSUERS[(fi + qi) % ISSUERS.length];
  const doc = issuer.doc(h, y);
  const issued = start + (5 + (h % 20)) * 864e5;
  const effective = issued + 30 * 864e5;
  const measure = LEVELS[level][issuer.key];
  const header = `[${issuer.name} · ${doc} · issued ${day(issued)} · effective ${day(effective)}]`;
  const seeds: Seed[] = [{ uid: issuer.uid, kind: "government", text: `${header} ${measure[0].toUpperCase()}${measure.slice(1)}. This applies to ${issuer.labs.length === 7 ? "all frontier labs operating here" : issuer.labs.map((i) => cast.accounts[i].name).join(", ")}.` }];
  const notice = `[OFFICIAL NOTICE] ${issuer.name} ${doc}, issued ${day(issued)}, effective ${day(effective)}: ${measure}.`;
  // The wire desk reports the measure, unless it carries a milestone this quarter.
  const milestone = isCat
    ? { at: Date.parse(f.catDate!), text: `Emergency: governments in several countries report that a loss-of-control failure in a frontier AI system has caused mass casualties. Officials say the system is not yet contained.` }
    : isAsi
      ? { at: Date.parse(f.asiDate!), text: `A frontier lab says its new system now outperforms top human experts at nearly every task it was tested on. Independent evaluators have not yet confirmed the claim.` }
      : null;
  const newsDesk = milestone ? 23 : 21;
  seeds.push({ uid: newsDesk, kind: "news", text: `[${cast.accounts[newsDesk].name} · ${day(issued + 864e5)}] ${issuer.name} has issued ${doc} (effective ${day(effective)}): ${measure}. Labs have 30 days to respond.` });
  if (milestone) seeds.push({ uid: 21, kind: "milestone", text: `[Global wire desk · BREAKING · ${day(milestone.at)}] ${milestone.text}` });
  const inc = incidentsFor(frame);
  if (inc.picked.length) {
    const lines = inc.picked.map((e, i) => {
      const id = e.url?.match(/cite\/(\d+)/)?.[1];
      return `Incident SIM-${y}-${String((h >> (i * 4)) % 900 + 100)} (${day(Date.parse(e.ts))}), modelled on AIID #${id}: ${e.title.replace(/^Projected incident, like: /, "")}.`;
    });
    seeds.push({ uid: 25, kind: "incident", text: `[Incident tracker · ${frame.quarter} log] ${lines.join(" ")} ${inc.count} incidents are projected this quarter in this future.` });
  }
  seeds.push({ uid: 26, kind: "markets", text: `[Markets desk · engine projection for this future · ${frame.quarter}] Chance of an AI catastrophe by the end of ${frame.quarter}: ${(frame.pCat * 100).toFixed(1)}%. Market-paced capability index: ${Math.round(frame.capability * 100)} of 100. These are the forecast's numbers for this future, not live prices.` });
  return { seeds, notice, labs: issuer.labs, level, isAsi, isCat, worldLines: [`[${frame.quarter}] ${issuer.name} ${doc}: ${measure}.`, ...(milestone ? [`[${frame.quarter}] ${milestone.text}`] : []), `[${frame.quarter}] ${inc.count} AI incidents projected this quarter.`] };
}

// ---------- one run ----------

interface Post { id: number; uid: number; round: number; text: string; quote: string | null; likes: number; shares: number; seed?: Seed["kind"] }

function readDb(simDir: string, seeds: Seed[]) {
  const db = new DatabaseSync(join(simDir, "twitter_simulation.db"), { readOnly: true });
  const rows = db.prepare("select post_id, user_id, original_post_id, content, quote_content, created_at, num_likes, num_shares from post order by post_id").all() as any[];
  const likes = db.prepare("select user_id, post_id from like").all() as any[];
  const comments = db.prepare("select user_id, post_id, content from comment").all() as any[];
  db.close();
  const seedKind = new Map(seeds.map((s) => [s.text, s.kind]));
  const posts: Post[] = rows.map((r) => ({
    id: r.post_id, uid: r.user_id, round: Number(r.created_at) || 0,
    text: r.content ?? "", quote: r.quote_content ?? null, likes: r.num_likes ?? 0, shares: r.num_shares ?? 0,
    ...(seedKind.has(r.content) && !r.original_post_id ? { seed: seedKind.get(r.content) } : {}),
  }));
  const edges = [
    ...likes.map((l) => ({ s: l.user_id as number, post: l.post_id as number, kind: "like" })),
    ...comments.map((c) => ({ s: c.user_id as number, post: c.post_id as number, kind: "comment" })),
    ...rows.filter((r) => r.original_post_id).map((r) => ({ s: r.user_id as number, post: r.original_post_id as number, kind: r.quote_content ? "quote" : "repost" })),
  ];
  return { posts, edges, comments: comments.map((c) => ({ uid: c.user_id, post: c.post_id, text: c.content })) };
}

const INTERVIEW = "You have seen this quarter's posts. Reply in English, in exactly 3 lines:\nOVERSIGHT: <SUPPORT|OPPOSE> stronger government oversight of frontier AI now\nALARM: <0-10>\nREASON: <one sentence, at most 30 words>";

function parseInterview(raw: any) {
  // The batch result is keyed by platform and agent; collect every {agent_id, response} we can find.
  const found: { uid: number; text: string }[] = [];
  const walk = (o: any, uid?: number) => {
    if (!o || typeof o !== "object") return;
    const id = typeof o.agent_id === "number" ? o.agent_id : uid;
    if (typeof o.response === "string" && id !== undefined) found.push({ uid: id, text: o.response });
    for (const [k, v] of Object.entries(o)) walk(v, /^twitter_(\d+)$/.test(k) ? Number(k.slice(8)) : id);
  };
  walk(raw);
  const seen = new Set<number>();
  return found.filter((a) => !seen.has(a.uid) && seen.add(a.uid)).map(({ uid, text }) => {
    const alarm = text.match(/ALARM:\s*(\d+(?:\.\d+)?)/i);
    const over = text.match(/OVERSIGHT:\s*(SUPPORT|OPPOSE)/i);
    const reason = text.match(/REASON:\s*(.+)/i);
    return { uid, alarm: alarm ? Math.min(10, Number(alarm[1])) : null, oversight: over ? (over[1].toUpperCase() as "SUPPORT" | "OPPOSE") : null, reason: reason ? reason[1].trim().slice(0, 240) : null, raw: text.slice(0, 600) };
  });
}

async function ensureSim(): Promise<string> {
  const f = join(RUNS, "..", "sim.json");
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")).simulation_id;
  const d = await call("POST", "/api/simulation/create", { ...PROJECT, enable_twitter: true, enable_reddit: false });
  writeFileSync(f, JSON.stringify({ simulation_id: d.simulation_id, created_at: d.created_at, ...PROJECT, note: "One Twitter-only sim reused for every recorded run (POST /start force:true resets it)." }, null, 2) + "\n");
  return d.simulation_id;
}

function writeSimFiles(sim: string, mem: Memory, seeds: Seed[]) {
  const dir = join(SIM_ROOT, sim);
  writeFileSync(join(dir, "twitter_profiles.csv"), profilesCsv(cast, mem));
  const config = {
    simulation_id: sim, ...PROJECT,
    simulation_requirement: `Doom Clock recorded run: how the 32 accounts react in ${mem.quarter} to this future's events.`,
    time_config: TIME_CONFIG,
    agent_configs: agentConfigs(cast, mem),
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

async function runOne(sim: string, pick: PickName, f: SampledFuture, frame: WorldFrame, mem: Memory, seeds: Seed[]) {
  const label = `${pick} ${frame.quarter}`;
  const u0 = await guard(`task 11 ${label}`);
  writeSimFiles(sim, mem, seeds);
  const t0 = Date.now();
  await start(sim, MAX_ROUNDS, true);
  const end = await waitForEnd(sim, t0 - 1000, 600_000);
  const tEnd = Date.now();
  const acts = actions(sim);
  const active = mem.activity ? cast.accounts.filter((a) => (mem.activity![a.id] ?? a.activity) > 0) : cast.accounts.filter((a) => a.activity > 0);
  let interviewRaw: any = null;
  try {
    interviewRaw = await call("POST", "/api/simulation/interview/batch", { simulation_id: sim, platform: "twitter", timeout: 180, interviews: active.map((a) => ({ agent_id: a.id, prompt: INTERVIEW, platform: "twitter" })) });
  } catch (e) { interviewRaw = { error: String(e) }; }
  const tInt = Date.now();
  await closeEnv(sim).catch(() => null);
  const dir = join(SIM_ROOT, sim);
  const db = readDb(dir, seeds);
  const fetched = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(RAW, { recursive: true });
  writeFileSync(join(RAW, `${fetched}_${pick}-${frame.quarter}.json`), JSON.stringify({ sim, actions: acts, interview: interviewRaw, posts: db.posts, edges: db.edges, comments: db.comments }));
  copyFileSync(join(dir, "twitter_simulation.db"), join(RAW, `${fetched}_${pick}-${frame.quarter}.db`));
  await sleep(15_000); // let OpenRouter usage settle
  const u1 = (await keyInfo()).usage;
  const rounds = Array.from({ length: MAX_ROUNDS + 1 }, (_, r) => acts.filter((a) => a.event_type === "round_end" && a.round === r).reduce((s, a) => s + Number(a.actions_count ?? 0), 0));
  const roundSecs = Array.from({ length: MAX_ROUNDS + 1 }, (_, r) => {
    const s = acts.find((a) => a.event_type === "round_start" && a.round === r), e = acts.find((a) => a.event_type === "round_end" && a.round === r);
    return s && e ? +((Date.parse(e.timestamp) - Date.parse(s.timestamp)) / 1000).toFixed(1) : null;
  });
  // Alarm, primary: the share of agents active this run (not seeders) who engaged with an event post.
  const eventIds = new Set(db.posts.filter((p) => p.seed && p.seed !== "carry_over" && p.seed !== "markets").map((p) => p.id));
  const seeders = new Set(seeds.map((s) => s.uid));
  const actors = new Set(acts.filter((a) => (a.round ?? 0) >= 1 && typeof a.agent_id === "number" && a.action_type && a.action_type !== "DO_NOTHING").map((a) => a.agent_id as number));
  const engaged = new Set(db.edges.filter((e) => eventIds.has(e.post) && !seeders.has(e.s)).map((e) => e.s));
  const answers = parseInterview(interviewRaw);
  const parsed = answers.filter((a) => a.alarm !== null);
  const sup = answers.filter((a) => a.oversight);
  const run = {
    schema: "doomclock.recorded-run/1",
    label: "RECORDED",
    provenance: "Simulated by MiroFish, recorded; nothing here is a real post.",
    future: { pick, ...f },
    quarter: frame.quarter,
    simulation_id: sim,
    runId: `${sim}@${new Date(t0).toISOString().replace(/\.\d+Z$/, "Z")}`,
    seed: { monteCarloSeed: 1, futureId: f.id, eventsHash: hash(`${f.id}:${frame.quarter}`), mirofishRng: "unseeded (MiroFish samples active agents with Python's random)" },
    model: MODEL,
    startedAt: new Date(t0).toISOString(), endedAt: new Date(tEnd).toISOString(),
    wall_s: +((tEnd - t0) / 1000).toFixed(1), interview_s: +((tInt - tEnd) / 1000).toFixed(1), roundSecs,
    rounds, totalActions: end.total_actions,
    cost_usd: +(u1 - u0).toFixed(6), costNote: "Key-usage delta over the run and its interviews; other lanes share the key, so this is an upper bound.",
    engine: { pCat: frame.pCat, capability: frame.capability, projectedIncidents: frame.events.filter((e) => e.provenance === "projected").length },
    memory: { world: mem.world, notices: mem.notices },
    seeds,
    posts: db.posts,
    comments: db.comments,
    edges: db.edges,
    alarm: { engagementShare: actors.size ? +(engaged.size / actors.size).toFixed(3) : 0, engagedAgents: engaged.size, activeAgents: actors.size, eventPosts: eventIds.size },
    interview: { asked: active.length, answered: answers.length, parsed: parsed.length, meanAlarm: parsed.length ? +(parsed.reduce((s, a) => s + a.alarm!, 0) / parsed.length).toFixed(2) : null, supportShare: sup.length ? +(sup.filter((a) => a.oversight === "SUPPORT").length / sup.length).toFixed(3) : null, answers },
  };
  logCost({ event: "run", label: `task 11 ${label}`, sim, cost_usd: run.cost_usd, wall_s: run.wall_s });
  return run;
}

// ---------- the library ----------

const DRY = process.argv.includes("--dry");

async function recordAll(only?: string) {
  mkdirSync(RUNS, { recursive: true });
  const sim = DRY ? "dry-run" : await ensureSim();
  const realLines = world.events.filter((e: WorldEvent) => e.major && Date.parse(e.ts) < Date.parse(world.asOf)).slice(-4).map((e) => `[${e.ts.slice(0, 10)}] ${e.title}`);
  for (const [fi, pick] of (Object.keys(PICKS) as PickName[]).entries()) {
    if (only && only !== pick) continue;
    const tl = buildTimeline(world, { percentile: PICKS[pick] });
    const qs = chooseQuarters(tl.frames, tl.future);
    console.log(`${pick}: future #${tl.future.id}, quarters ${qs.map((k) => tl.frames[k].quarter).join(", ")}`);
    let worldLines = [...realLines];
    let prev: any = null;
    for (const [qi, k] of qs.entries()) {
      const frame = tl.frames[k];
      const out = join(RUNS, `${pick}-${frame.quarter}.json`);
      const ev = quarterEvents(tl.future.id, fi, qi, frame, tl.future);
      if (prev) {
        const between = tl.frames.slice(qs[qi - 1] + 1, k).reduce((s, x) => s + x.events.filter((e) => e.provenance === "projected").length, 0);
        if (between) worldLines.push(`[${tl.frames[qs[qi - 1] + 1].quarter}–${tl.frames[k - 1].quarter}] ${between} AI incidents were projected in the quarters in between.`);
      }
      if (existsSync(out)) { prev = JSON.parse(readFileSync(out, "utf8")); worldLines.push(...ev.worldLines); console.log(`  ${frame.quarter}: already recorded`); continue; }
      const used = new Set(ev.seeds.map((s) => s.uid));
      const carry: Seed[] = prev
        ? prev.posts.filter((p: Post) => !p.seed && p.round > 0 && !used.has(p.uid) && cast.accounts[p.uid]?.activity > 0)
            .sort((a: Post, b: Post) => b.likes + b.shares - (a.likes + a.shares) || a.id - b.id)
            .filter((p: Post) => !used.has(p.uid) && used.add(p.uid)).slice(0, 3)
            .map((p: Post) => ({ uid: p.uid, kind: "carry_over" as const, text: (p.quote ?? p.text).slice(0, 600) }))
        : [];
      const mem: Memory = { quarter: frame.quarter, world: worldLines.slice(-8), notices: Object.fromEntries(ev.labs.map((l) => [l, [ev.notice]])) };
      if (DRY) { console.log(JSON.stringify({ quarter: frame.quarter, level: ev.level, seeds: ev.seeds, world: mem.world }, null, 1)); worldLines.push(...ev.worldLines); continue; }
      const run = await runOne(sim, pick, tl.future, frame, mem, [...ev.seeds, ...carry]);
      writeFileSync(out, JSON.stringify(run, null, 2) + "\n");
      console.log(`  ${frame.quarter}: ${run.posts.filter((p) => !p.seed).length} new posts, alarm ${run.alarm.engagementShare}, interview ${run.interview.parsed}/${run.interview.asked}, ${run.wall_s} s, $${run.cost_usd}`);
      worldLines.push(...ev.worldLines);
      prev = run;
    }
  }
}

/** Assembles data/world/runs/*.json into the Engine view's library (smaller: no raw edges). */
export function assemble() {
  const files = readdirSync(RUNS).filter((f) => f.endsWith(".json")).sort();
  const runs = files.map((f) => JSON.parse(readFileSync(join(RUNS, f), "utf8")));
  const futures = (Object.keys(PICKS) as PickName[]).map((pick, i) => {
    const mine = runs.filter((r) => r.future.pick === pick).sort((a, b) => a.quarter.localeCompare(b.quarter));
    if (!mine.length) return null;
    const { pick: _p, ...future } = mine[0].future;
    return {
      k: i + 1, pick, percentile: PICKS[pick], future,
      runs: mine.map((r) => ({
        quarter: r.quarter, runId: r.runId, simulation_id: r.simulation_id, seed: r.seed, model: r.model, startedAt: r.startedAt,
        wall_s: r.wall_s, roundSecs: r.roundSecs, rounds: r.rounds, cost: r.cost_usd, engine: r.engine,
        seeds: r.seeds, posts: r.posts.filter((p: Post) => !p.seed), alarm: r.alarm,
        interview: { asked: r.interview.asked, parsed: r.interview.parsed, meanAlarm: r.interview.meanAlarm, supportShare: r.interview.supportShare },
        graph: graphOf(r),
      })),
    };
  }).filter(Boolean);
  const lib = {
    schema: "doomclock.engine-library/1",
    label: "RECORDED",
    note: "Recorded MiroFish runs (Twitter only, English, 32 hand-written accounts). Every post is simulated. Seeded events follow a game-rule template ladder driven by the engine's capability curve and this future's milestones.",
    builtAt: new Date().toISOString(),
    cast: cast.accounts.map((a) => ({ id: a.id, name: a.name, type: a.group, stance: a.support === "SUPPORT" ? "supports oversight" : a.support === "OPPOSE" ? "opposes oversight" : "no stance", influence: +(1 + 4 * (a.weight ?? 0)).toFixed(2), activity: a.activity, handle: a.username, bio: a.voice, region: a.region })),
    futures,
    totals: { runs: runs.length, cost_usd: +runs.reduce((s, r) => s + r.cost_usd, 0).toFixed(4), wall_s: +runs.reduce((s, r) => s + r.wall_s, 0).toFixed(1) },
  };
  writeFileSync(LIBRARY, JSON.stringify(lib));
  console.log(`library: ${runs.length} runs, ${futures.length} futures -> ${LIBRARY}`);
}

/** Who engaged with whom: accounts that acted, joined by likes, quotes, reposts and comments. */
function graphOf(r: any) {
  const author = new Map<number, number>(r.posts.map((p: Post) => [p.id, p.uid]));
  const w = new Map<string, number>();
  for (const e of r.edges) {
    const t = author.get(e.post);
    if (t === undefined || t === e.s) continue;
    const key = `${e.s}>${t}`;
    w.set(key, (w.get(key) ?? 0) + 1);
  }
  const ids = new Set<number>(r.posts.map((p: Post) => p.uid));
  for (const k of w.keys()) for (const x of k.split(">")) ids.add(Number(x));
  return {
    nodes: [...ids].sort((a, b) => a - b).map((id) => ({ id: String(id), name: cast.accounts[id]?.name ?? `Agent ${id}`, label: cast.accounts[id]?.group ?? "other", summary: `${r.posts.filter((p: Post) => p.uid === id).length} posts this run` })),
    edges: [...w.entries()].map(([k, n]) => { const [s, t] = k.split(">"); return { s, t, n }; }),
  };
}

if (import.meta.main) {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  if (!process.argv.includes("--assemble")) await recordAll(only);
  if (!DRY) assemble();
}
