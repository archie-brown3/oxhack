// Task 155: turns what record.ts saved under data/world/futures/<id>/ into the Engine replica's files,
// doomclock/web/public/cache/replica/<id>/{project,step-<s>}.json (shape: web/src/ui/engine/replica/types.ts).
// Only saved responses are read; the browser never calls MiroFish.
// Usage: node doomclock/pipeline/world/replica.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../../..");
const FUTURES = join(ROOT, "data/world/futures");
const OUT = join(ROOT, "doomclock/web/public/cache/replica");

const read = (f: string): any => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
/** MiroFish wraps payloads as { success, data }. */
const data = (f: string): any => { const j = read(f); return j && typeof j === "object" && "data" in j ? j.data : j; };

export function replicaStep(dir: string) {
  const report = data(join(dir, "report.json"));
  const agentLog = data(join(dir, "agent-log.json"));
  const consoleLog = data(join(dir, "console-log.json"));
  return {
    simulation: read(join(dir, "state.json")),
    profiles: data(join(dir, "api-profiles.json"))?.profiles ?? [],
    config: data(join(dir, "api-config.json")),
    runStatus: data(join(dir, "api-run-status.json")),
    actions: data(join(dir, "api-actions.json"))?.actions ?? [],
    posts: data(join(dir, "api-posts.json"))?.posts ?? [],
    timeline: data(join(dir, "api-timeline.json"))?.timeline ?? [],
    agentStats: data(join(dir, "api-agent-stats.json"))?.stats ?? [],
    graph: data(join(dir, "graph-data.json")),
    report,
    sections: (report?.outline?.sections ?? []).map((s: { title: string; content: string }, i: number) => ({ section_index: i + 1, filename: `section_${String(i + 1).padStart(2, "0")}.md`, content: `## ${s.title}\n\n${s.content}` })),
    agentLog: agentLog?.logs ?? agentLog ?? [],
    consoleLog: consoleLog?.logs ?? consoleLog ?? [],
  };
}

if (import.meta.main) {
  for (const id of [1, 2, 3]) {
    const project = data(join(FUTURES, String(id), "step1", "project-state.json"));
    if (!project) continue;
    const out = join(OUT, String(id));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "project.json"), JSON.stringify(project));
    let n = 0;
    for (let s = 1; existsSync(join(FUTURES, String(id), `step-${s}`, "step.json")); s++, n++)
      writeFileSync(join(out, `step-${s}.json`), JSON.stringify(replicaStep(join(FUTURES, String(id), `step-${s}`))));
    console.log(`replica: future ${id}, ${n} steps -> ${out}`);
  }
}
