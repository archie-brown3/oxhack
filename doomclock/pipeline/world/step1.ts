// Task 152: MiroFish's real Step 1 for each future: one project and one Zep graph per future, built
// from the same "world today" seed pack (today's odds, the last 6 months of real incidents and
// government acts, the 32-account cast) and the project question. Saves each project's ontology,
// build output and graph for the replica's Step 1 under data/world/futures/<id>/step1/.
// Usage: node doomclock/pipeline/world/step1.ts [--future=1] [--pack]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BASE, call, sleep } from "../mirofish/api.ts";
import { logCost } from "../mirofish/budget.ts";
import { loopCast, type Cast } from "../../web/src/game/cast.ts";
import { realPeriod } from "./format.ts";
import type { World, WorldEvent } from "../../web/src/contracts.ts";

const ROOT = join(import.meta.dirname, "../../..");
const PACK_DIR = join(ROOT, "data/world/seed-pack");
export const QUESTION = "Over the next six months, which AI incidents, government decisions and lab actions happen, and how dangerous does the world become?";
const world = JSON.parse(readFileSync(join(ROOT, "doomclock/web/public/cache/world.json"), "utf8")) as World;
const events = (JSON.parse(readFileSync(join(ROOT, "data/events.json"), "utf8")).events ?? []) as WorldEvent[];
const cast = loopCast(JSON.parse(readFileSync(join(ROOT, "doomclock/web/src/game/data/cast.json"), "utf8")) as Cast);

const day = (ts: string) => ts.slice(0, 10);
/** One short line. Detail text is what blew the first pack out to 38 KB and 115 Zep episodes. */
const line = (e: WorldEvent) => `- ${day(e.ts)}: ${e.who ? e.who + " — " : ""}${e.title}`.slice(0, 180);

/** The first build sent 115 episodes from a 38 KB pack and Zep stalled at 600 s. Keep this under 12 KB. */
export const SEED_PACK_MAX = 12_000;

/** The "world today" document every future's graph is built from. Real data up to today, nothing after. */
export function seedPack(): string {
  const { events: period, incidents } = realPeriod(events, world.asOf);
  const a = world.anchors;
  const pick = (kind: WorldEvent["kind"], n: number) => period
    .filter((e) => e.kind === kind)
    .sort((x, y) => Number(!!y.major || y.severity === "major") - Number(!!x.major || x.severity === "major") || Date.parse(y.ts) - Date.parse(x.ts))
    .slice(0, n);
  const incs = pick("incident", 12);
  const gov = pick("government", 8);
  const text = [
    `# The world on ${day(world.asOf)}`,
    `Starting point of a simulation. Everything below was public before ${day(world.asOf)}.`,
    `## Markets`,
    `- Powerful AI by 2030: ${(a.asi2030 * 100).toFixed(0)}%. By 2040: ${(a.asi2040 * 100).toFixed(0)}%. By 2100: ${(a.asi2100 * 100).toFixed(0)}%.`,
    `- AI catastrophe by 2100: ${(a.cat2100 * 100).toFixed(1)}% (a thin play-money market).`,
    `## Incidents in the last six months (${incidents} logged; ${incs.length} listed)`,
    ...incs.map(line),
    `## Government acts in the last six months`,
    ...gov.map(line),
    `## Actors`,
    ...cast.accounts.map((c) => `- ${c.name} (${c.group}, ${c.region}): ${(c.goals[0] ?? "").slice(0, 90)}`),
  ].join("\n") + "\n";
  if (text.length > SEED_PACK_MAX) throw new Error(`seed pack is ${text.length} chars; the limit is ${SEED_PACK_MAX} so the Zep build can finish`);
  return text;
}

async function form(path: string, fd: FormData) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Accept-Language": "en" }, body: fd });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`POST ${path}: HTTP ${r.status} ${j.error ?? ""}`);
  return j.data ?? j;
}

const save = (dir: string, name: string, v: unknown) => writeFileSync(join(dir, name), typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n");

export async function step1(id: number) {
  const dir = join(ROOT, "data/world/futures", String(id), "step1");
  if (existsSync(join(dir, "project.json"))) { const p = JSON.parse(readFileSync(join(dir, "project.json"), "utf8")); console.log(`future ${id}: already built (${p.graph_id})`); return p; }
  mkdirSync(dir, { recursive: true });
  mkdirSync(PACK_DIR, { recursive: true });
  const pack = seedPack();
  writeFileSync(join(PACK_DIR, "world-today.md"), pack);
  const t0 = Date.now();
  const fd = new FormData();
  fd.append("files", new Blob([pack], { type: "text/markdown" }), "world-today.md");
  fd.append("simulation_requirement", QUESTION);
  fd.append("project_name", `Doom Clock future ${id}`);
  const ont = await form("/api/graph/ontology/generate", fd);
  save(dir, "ontology.json", ont);
  const projectId = ont.project_id as string;
  const b = await call("POST", "/api/graph/build", { project_id: projectId, graph_name: `Doom Clock future ${id}` });
  save(dir, "build-start.json", b);
  let task: any;
  for (;;) {
    await sleep(4000);
    task = await call("GET", `/api/graph/task/${b.task_id}`);
    if (task.status === "completed" || task.status === "failed") break;
    if (Date.now() - t0 > 900_000) throw new Error(`future ${id}: graph build still ${task.status} after 15 min`);
  }
  save(dir, "build-task.json", task);
  if (task.status === "failed") throw new Error(`future ${id}: build failed: ${task.error ?? task.message}`);
  const project = await call("GET", `/api/graph/project/${projectId}`);
  const graphId = project.graph_id as string;
  const graph = await call("GET", `/api/graph/data/${graphId}`);
  save(dir, "graph-data.json", graph);
  const out = { future: id, project_id: projectId, graph_id: graphId, nodes: graph.node_count ?? graph.nodes?.length, edges: graph.edge_count ?? graph.edges?.length, entity_types: ont.ontology?.entity_types?.length, edge_types: ont.ontology?.edge_types?.length, seedPackChars: pack.length, wall_s: +((Date.now() - t0) / 1000).toFixed(1), builtAt: new Date().toISOString(), question: QUESTION };
  save(dir, "project-state.json", project);
  save(dir, "project.json", out);
  logCost({ event: "step1", label: `step1 f${id}`, ...out });
  console.log(`future ${id}: ${projectId} ${graphId}, ${out.nodes} nodes, ${out.edges} edges, ${out.wall_s} s`);
  return out;
}

if (import.meta.main) {
  if (process.argv.includes("--pack")) { console.log(seedPack()); process.exit(0); }
  const only = process.argv.find((a) => a.startsWith("--future="))?.slice(9);
  for (const id of only ? [Number(only)] : [1, 2, 3]) await step1(id);
}
