// Task 156: the local live demo. Everything slow happens before the judge arrives, in `prepare`: it arms a
// fresh MiroFish simulation on a future's existing Step 1 graph (personas, config and seeds written from
// cast.json, no LLM) and, with --epoch, first runs one whole 6-month step with MiroFish's report agent and
// saves it for the report tab. `serve` is the small node:http server the web polls at /live/*: the button
// only does POST /api/simulation/start on the armed sim; the server fans out to MiroFish's GET endpoints so
// the Engine replica streams the rounds, and when the run ends it reads the events out, scores the rubric
// and moves that future's odds by the labelled game rules (engine/step.ts). Nothing moves the real clock.
// Local only: the production build never reaches it (web/scripts/check-inert.mjs). Graph memory updates
// are off for live runs: the Zep drain holds a run in STOPPING for minutes and failed this morning's runs
// (data/world/logs/2026-10-25-zep-timeout.log); the report agent still reads the Step 1 graph.
// Usage: node doomclock/pipeline/world/live.ts prepare [--future=1] [--epoch] [--rounds=5]
//        node doomclock/pipeline/world/live.ts serve [--port=5055]
// Step 5 (chat with the report agent, interview an agent) goes through POST /live/chat, /live/interview and
// /live/env-status, which forward to MiroFish's own routes; interviews need the run's environment alive, and
// POST /live/env-open opens a sibling environment (same personas, one round) for a recorded step.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { BASE, call, closeEnv, SIM_ROOT, sleep, waitForEnd } from "../mirofish/api.ts";
import { guard, keyInfo, logCost } from "../mirofish/budget.ts";
import { msToYear, stepAnchors, type Anchors } from "../../web/src/engine/step.ts";
import { MAX_ROUNDS } from "../../web/src/game/cast.ts";
import { formatPeriod } from "./format.ts";
import { fetchReport, futureProject, rubricPrompt, simulationCreateBody, startBody, type FutureProject } from "./loop.ts";
import { readOut } from "./readout.ts";
import { scoreRubric } from "./report.ts";
import { cast, date10Year, ensureIdle, loadBaseline, MARKETS, memoryFor, period, readDb, REAL_IDS, RULES_VERSION, stepStart, T0, world, writeSimFiles } from "./record.ts";

const ROOT = join(import.meta.dirname, "../../..");
const FUTURES = join(ROOT, "data/world/futures");
const LIVE = join(ROOT, "data/world/live");
const ARMED = join(LIVE, "armed.json");
const EPOCH = join(LIVE, "epoch");
const PORT = Number(process.env.LIVE_PORT ?? 5055);
// Live runs keep graph memory off (loop.ts startBody reads GRAPH_MEMORY); GRAPH_MEMORY=1 overrides.
process.env.GRAPH_MEMORY ??= "0";
const GRAPH_MEMORY = process.env.GRAPH_MEMORY !== "0";

type Seed = { uid: number; kind: string; text: string };
interface Armed { simulation_id: string; future: number; project_id: string; graph_id: string; rounds: number; seeds: Seed[]; preparedAt: string; usedAt: string | null }

const readJson = (f: string): any => JSON.parse(readFileSync(f, "utf8"));
const writeJson = (f: string, v: unknown) => { mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };
/** MiroFish wraps payloads as { success, data }. */
const unwrap = (j: any) => (j && typeof j === "object" && "data" in j ? j.data : j);
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const projectOf = (future: number): FutureProject => futureProject(readJson(join(FUTURES, String(future), "step1", "project.json")), future);
/** GET /api/graph/project/:id as saved by step1.ts: the replica's ReplicaProject. */
const projectState = (future: number) => unwrap(readJson(join(FUTURES, String(future), "step1", "project-state.json")));
const step1Graph = (future: number) => unwrap(readJson(join(FUTURES, String(future), "step1", "graph-data.json")));
const startAnchors = () => ({ ...world.anchors }) as Anchors;

// ---------- prepare ----------

/** A fresh simulation on a project's Step 1 graph, with the step-1 personas, config and seeds written (no LLM). */
async function createSim(project: FutureProject, rounds: number, requirement: string): Promise<Armed> {
  const created = await call("POST", "/api/simulation/create", simulationCreateBody(project));
  const sim: string = created.simulation_id;
  const mem = memoryFor(1, { events: [], summary: "", expected: [], anchors: startAnchors(), prevAnchors: null, date10: date10Year(startAnchors(), msToYear(T0)), topPosts: [] });
  const seeds: Seed[] = [{ uid: MARKETS, kind: "markets", text: `[Markets desk · ${period(1)}] ${mem.markets}` }];
  writeSimFiles(sim, project, mem, seeds, requirement);
  return { simulation_id: sim, future: project.future, project_id: project.project_id, graph_id: project.graph_id, rounds, seeds, preparedAt: new Date().toISOString(), usedAt: null };
}
const arm = (future: number, rounds: number, requirement: string) => createSim(projectOf(future), rounds, requirement);
/** Re-arm: the previous live sim's environment (kept alive for interviews) goes; the prepared epoch's stays. */
async function closePreviousArmed() { if (existsSync(ARMED)) { const prev: Armed = readJson(ARMED); if (prev.usedAt) await closeEnv(prev.simulation_id).catch(() => null); } }

// ---------- Step 5 on recorded steps: a fresh environment with the same personas ----------
// A recorded run's environment is gone, and re-running it would overwrite its data. Interviews go instead to a
// sibling sim on the same graph with the same 32 personas, run one round so MiroFish keeps its environment
// alive in wait-command mode. One per graph, reused while alive. Labelled "fresh environment, same personas".
interface Sibling { simulation_id: string; graph_id: string; project_id: string; phase: "starting" | "ready" | "failed"; error: string | null; startedAt: string; label: string }
const siblings = new Map<string, Sibling>();

async function openSibling(b: { simulation_id?: string; project_id?: string; graph_id?: string }): Promise<Sibling> {
  let { project_id, graph_id } = b;
  if ((!project_id || !graph_id) && b.simulation_id) { const st = await call("GET", `/api/simulation/${b.simulation_id}`); project_id = st.project_id; graph_id = st.graph_id; }
  if (!project_id || !graph_id) throw Object.assign(new Error("env-open needs simulation_id, or project_id and graph_id"), { status: 400 });
  const have = siblings.get(graph_id);
  if (have?.phase === "starting") return have;
  if (have?.phase === "ready") {
    const st = await call("POST", "/api/simulation/env-status", { simulation_id: have.simulation_id }).catch(() => null);
    if (st?.env_alive) return have;
  }
  const a = await createSim({ future: 0, project_id, graph_id }, 1, "Doom Clock interviews: a fresh environment with the same personas on this future's graph.");
  const sib: Sibling = { simulation_id: a.simulation_id, graph_id, project_id, phase: "starting", error: null, startedAt: new Date().toISOString(), label: "fresh environment, same personas" };
  siblings.set(graph_id, sib);
  (async () => {
    try { await runSim(a, `interview env ${graph_id}`, console.log); sib.phase = "ready"; console.log(`Interview environment ${a.simulation_id} ready on ${graph_id}`); }
    catch (e) { sib.phase = "failed"; sib.error = String((e as Error).message ?? e); }
  })();
  return sib;
}

/** The replica's step payload, from MiroFish's own GET endpoints, as they stand now. */
async function liveReplica(a: Armed, report: { report: any; agentLog: any; consoleLog: any } | null) {
  const sim = a.simulation_id;
  const get = (p: string) => fetch(BASE + p).then((r) => r.json()).then(unwrap).catch(() => null);
  const [simulation, runStatus, actions, posts, timeline, agentStats, profiles, config] = await Promise.all([
    get(`/api/simulation/${sim}`), get(`/api/simulation/${sim}/run-status`), get(`/api/simulation/${sim}/actions?limit=2000`),
    get(`/api/simulation/${sim}/posts?platform=twitter&limit=1000`), get(`/api/simulation/${sim}/timeline`), get(`/api/simulation/${sim}/agent-stats`),
    get(`/api/simulation/${sim}/profiles?platform=twitter`), get(`/api/simulation/${sim}/config`),
  ]);
  const rep = report?.report ?? null;
  return {
    simulation: simulation ?? { simulation_id: sim, project_id: a.project_id, graph_id: a.graph_id, status: "ready" },
    profiles: profiles?.profiles ?? [], config, runStatus: runStatus ?? { simulation_id: sim, runner_status: "idle", current_round: 0, total_rounds: a.rounds, started_at: null },
    actions: actions?.actions ?? [], posts: posts?.posts ?? [], timeline: timeline?.timeline ?? [], agentStats: agentStats?.stats ?? [],
    graph: step1Graph(a.future),
    report: rep ?? { report_id: "", simulation_id: sim, graph_id: a.graph_id, status: "none", simulation_requirement: "", markdown_content: "", outline: null, created_at: "", completed_at: null, error: null },
    sections: (rep?.outline?.sections ?? []).map((s: { title: string; content: string }, i: number) => ({ section_index: i + 1, filename: `section_${String(i + 1).padStart(2, "0")}.md`, content: `## ${s.title}\n\n${s.content}` })),
    agentLog: report?.agentLog?.logs ?? report?.agentLog ?? [], consoleLog: report?.consoleLog?.logs ?? report?.consoleLog ?? [],
  };
}

/** Starts the armed sim (graph memory off) and waits for simulation_end. The environment stays alive in
 *  wait-command mode afterwards, so Step 5 can interview the agents; `prepare` closes it on re-arm. */
async function runSim(a: Armed, label: string, log: (m: string) => void) {
  const u0 = await guard(label);
  await ensureIdle(a.simulation_id);
  const ts = Date.now();
  await call("POST", "/api/simulation/start", startBody(a.simulation_id, a.rounds));
  log(`Simulation ${a.simulation_id} started: ${a.rounds} rounds, graph memory ${GRAPH_MEMORY ? "on" : "off"}`);
  await waitForEnd(a.simulation_id, ts - 1000, 600_000);
  const wall_s = +((Date.now() - ts) / 1000).toFixed(1);
  await sleep(6000);
  const cost_usd = +((await keyInfo()).usage - u0).toFixed(6);
  logCost({ event: "run", label, sim: a.simulation_id, cost_usd, wall_s, live: true });
  log(`Simulation ended after ${wall_s} s, $${cost_usd}`);
  return { wall_s, cost_usd };
}

/** One whole step ahead of time, report agent included, saved under data/world/live/epoch/ for the report tab. */
async function epoch(future: number, rounds: number) {
  const a = await arm(future, rounds, `Doom Clock live demo, prepared epoch: how the 32 accounts react in ${period(1)}.`);
  const t0 = Date.now();
  const run = await runSim(a, `live epoch f${future}`, console.log);
  console.log("Report agent running (it took about 4 min in earlier runs)…");
  const r0 = Date.now();
  const pack = await fetchReport(call, a.simulation_id, () => sleep(4000), 225);
  const report_s = +((Date.now() - r0) / 1000).toFixed(1);
  const step = await liveReplica(a, pack);
  writeJson(join(EPOCH, "project.json"), projectState(future));
  writeJson(join(EPOCH, "step-1.json"), step);
  writeJson(join(EPOCH, "epoch.json"), { ...a, usedAt: new Date().toISOString(), report_id: pack.report_id, run, report_s, wall_s: +((Date.now() - t0) / 1000).toFixed(1), rulesVersion: RULES_VERSION });
  console.log(`Epoch saved: ${a.simulation_id}, report ${pack.report_id}, run ${run.wall_s} s, report ${report_s} s, $${run.cost_usd} -> ${EPOCH}`);
}

// ---------- the coupled-loop step after a live run ----------

async function coupledResult(a: Armed, log: (m: string) => void) {
  const { posts } = readDb(join(SIM_ROOT, a.simulation_id), new Map(a.seeds.map((x) => [x.text, x.kind])));
  const start = stepStart(1), end = stepStart(2);
  log(`Reading events out of ${posts.length} posts…`);
  const ro = await readOut({ cast, posts, futureId: a.future, step: 1, start, end, seenKeys: [], realIds: REAL_IDS });
  const base = loadBaseline();
  const fmt = formatPeriod(ro.events, base.incidents);
  let rubric = base.rubric, rubricOk = false, cost = ro.cost;
  if (ro.ok) {
    log(`${ro.events.length} events read out (${ro.rejected.length} rejected). Scoring the rubric from the events…`);
    const sc = await scoreRubric(`live ${a.simulation_id}`, rubricPrompt("(live run: no situation report, graph memory off; score from the events)", fmt.text), rubric);
    rubric = sc.rubric; rubricOk = sc.ok; cost += sc.cost;
  } else log("Readout failed: no events; the odds move by decay and noise only");
  const from = startAnchors();
  const args = { today: from, start, end, events: ro.events, rubric, baseline: base.rubric, future: a.future, step: 1 };
  const anchors = stepAnchors({ ...args, from }, {});
  const off = stepAnchors({ ...args, from }, { nudges: false, rubric: false });
  const none = stepAnchors({ ...args, from }, { nudges: false, rubric: false, noise: false });
  const at = msToYear(Date.parse(end));
  const result = {
    step: 1, start, end, events: ro.events, rejected: ro.rejected.length, readoutOk: ro.ok, rubric, rubricOk, baseline: base.rubric,
    startAnchors: from, anchors, date10Before: date10Year(from, msToYear(T0)), date10: date10Year(anchors, at), rulesOffDate10: date10Year(off, at), noEventsDate10: date10Year(none, at),
    llmCost: +cost.toFixed(4), rulesVersion: RULES_VERSION, label: "SIMULATED · GAME RULE",
  };
  log(`Clock for future ${a.future}: 1-in-10 date ${result.date10Before} -> ${result.date10} (rules off ${result.rulesOffDate10}, no events ${result.noEventsDate10}); game rules ${RULES_VERSION}`);
  return result;
}

// ---------- serve ----------

interface Run { armed: Armed | null; phase: "idle" | "running" | "readout" | "done" | "failed"; startedAt: string | null; endedAt: string | null; log: { t: string; msg: string }[]; run: { wall_s: number; cost_usd: number } | null; result: Awaited<ReturnType<typeof coupledResult>> | null; error: string | null }

function serve(port: number) {
  const run: Run = { armed: null, phase: "idle", startedAt: null, endedAt: null, log: [], run: null, result: null, error: null };
  const log = (msg: string) => { run.log = [...run.log.slice(-199), { t: new Date().toISOString(), msg }]; console.log(msg); };
  const armed = (): Armed | null => (existsSync(ARMED) ? readJson(ARMED) : null);
  const reportCache = new Map<string, Promise<any>>();

  async function start() {
    const a = armed();
    if (!a) throw Object.assign(new Error("nothing armed: run `node doomclock/pipeline/world/live.ts prepare` first"), { status: 409 });
    if (a.usedAt) throw Object.assign(new Error(`${a.simulation_id} already ran at ${a.usedAt}: run prepare again to re-arm`), { status: 409 });
    if (run.phase === "running" || run.phase === "readout") throw Object.assign(new Error(`${run.armed?.simulation_id} is still ${run.phase}`), { status: 409 });
    Object.assign(run, { armed: a, phase: "running", startedAt: new Date().toISOString(), endedAt: null, log: [], run: null, result: null, error: null });
    a.usedAt = run.startedAt; writeJson(ARMED, a);
    (async () => {
      try {
        run.run = await runSim(a, `live f${a.future}`, log);
        run.phase = "readout";
        run.result = await coupledResult(a, log);
        run.phase = "done";
      } catch (e) { run.phase = "failed"; run.error = String((e as Error).message ?? e); log(`Failed: ${run.error}`); }
      run.endedAt = new Date().toISOString();
    })();
  }

  const body = (req: IncomingMessage) => new Promise<any>((ok, no) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } }); req.on("error", no); });
  // Step 5: MiroFish's own chat and interview routes, reached only through this local server.
  const STEP5: Record<string, (b: any) => [string, unknown]> = {
    "/live/chat": (b) => ["/api/report/chat", { simulation_id: b.simulation_id, message: b.message, chat_history: b.chat_history ?? [] }],
    "/live/interview": (b) => ["/api/simulation/interview", { simulation_id: b.simulation_id, agent_id: b.agent_id, prompt: b.prompt, platform: "twitter", timeout: b.timeout ?? 90 }],
    "/live/env-status": (b) => ["/api/simulation/env-status", { simulation_id: b.simulation_id }],
  };
  const send = (res: ServerResponse, status: number, body: unknown) => { res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/live/state") {
        const a = run.armed ?? armed();
        const replica = run.armed ? await liveReplica(run.armed, null) : null;
        return send(res, 200, { armed: armed(), run: { ...run, armed: run.armed && { simulation_id: run.armed.simulation_id, future: run.armed.future, rounds: run.armed.rounds } }, project: a ? projectState(a.future) : null, graph: a ? step1Graph(a.future) : null, replica, backend: BASE, now: new Date().toISOString() });
      }
      if (req.method === "POST" && url.pathname === "/live/start") { await start(); return send(res, 200, { ok: true, simulation_id: run.armed?.simulation_id, startedAt: run.startedAt }); }
      if (req.method === "GET" && url.pathname === "/live/report") {
        if (!existsSync(join(EPOCH, "step-1.json"))) return send(res, 404, { error: "no prepared epoch: run `node doomclock/pipeline/world/live.ts prepare --epoch`" });
        let p = reportCache.get("epoch");
        if (!p) reportCache.set("epoch", (p = Promise.resolve({ project: readJson(join(EPOCH, "project.json")), step: readJson(join(EPOCH, "step-1.json")), epoch: readJson(join(EPOCH, "epoch.json")) })));
        return send(res, 200, await p);
      }
      if (req.method === "POST" && url.pathname === "/live/env-open") return send(res, 200, await openSibling(await body(req)));
      if (req.method === "POST" && STEP5[url.pathname]) { const [path, payload] = STEP5[url.pathname](await body(req)); return send(res, 200, await call("POST", path, payload)); }
      if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "*" }); return res.end(); }
      send(res, 404, { error: `no ${req.method} ${url.pathname}` });
    } catch (e) { send(res, (e as { status?: number }).status ?? 500, { error: String((e as Error).message ?? e) }); }
  });
  server.listen(port, "127.0.0.1", () => console.log(`live: http://127.0.0.1:${port}/live/state (MiroFish at ${BASE}); armed: ${armed()?.simulation_id ?? "nothing, run prepare"}`));
}

if (import.meta.main) {
  const cmd = process.argv[2];
  const future = Number(arg("future") ?? 1), rounds = Number(arg("rounds") ?? MAX_ROUNDS);
  if (cmd === "prepare") {
    await closePreviousArmed();
    if (process.argv.includes("--epoch")) await epoch(future, rounds);
    const a = await arm(future, rounds, `Doom Clock live demo: how the 32 accounts react in ${period(1)}.`);
    writeJson(ARMED, a);
    console.log(`Armed ${a.simulation_id} on future ${future} (${a.project_id}, ${a.graph_id}), ${rounds} rounds. Press Run live in the Engine tab (?view=engine&live=1).`);
  } else if (cmd === "serve") serve(Number(arg("port") ?? PORT));
  else { console.error("usage: live.ts prepare [--future=1] [--epoch] [--rounds=5] | serve [--port=5055]"); process.exit(2); }
}
