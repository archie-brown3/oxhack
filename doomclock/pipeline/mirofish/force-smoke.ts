// Task 105: does POST /start {force:true} really reset a completed Twitter-only sim?
// Restarts the spike sim for one round, checks actions.jsonl was cleared and a fresh
// simulation_end appears, that /run-status reports the new run, then closes the env.
// Writes data/tests/force-smoke.json naming the restart method turn.ts must use. About $0.02.
// Usage: node doomclock/pipeline/mirofish/force-smoke.ts [sim id]
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { actions, closeEnv, localToIso, runStatus, sleep, start, waitForEnd } from "./api.ts";
import { guard, keyInfo, logCost } from "./budget.ts";

const SIM = process.argv[2] ?? "sim_908b44137fec";
const OUT = join(import.meta.dirname, "../../../data/tests/force-smoke.json");

const before = actions(SIM);
const lastEnd = before.filter((a) => a.event_type === "simulation_end").at(-1);
const u0 = await guard("task 105 force smoke");
const t0 = Date.now();
const started = await start(SIM, 1, true);
await sleep(1500);
const linesAfterStart = actions(SIM).length;
const statusRunning = await runStatus(SIM);
const end = await waitForEnd(SIM, t0 - 1000, 300_000);
const wall = (Date.now() - t0) / 1000;
// The runner keeps the env alive for interviews after simulation_end, so it reports "running"
// until close-env; read the final status after closing.
const closed = await closeEnv(SIM).then((d) => ({ ok: true, d }), (e) => ({ ok: false, d: String(e) }));
let statusDone = await runStatus(SIM);
for (let i = 0; i < 10 && statusDone.runner_status === "running"; i++) { await sleep(2000); statusDone = await runStatus(SIM); }
await sleep(25_000); // let OpenRouter usage settle
const u1 = (await keyInfo()).usage;
const after = actions(SIM);

const checks = {
  actionsResetAtStart: linesAfterStart < before.length,
  newSimulationEndLater: !!lastEnd && Date.parse(end.timestamp) > Date.parse(lastEnd.timestamp),
  runStatusNewRun: statusRunning.runner_status === "running" && statusDone.runner_status === "completed" && Date.parse(statusDone.started_at) > t0 - 5000,
  closeEnvOk: closed.ok,
};
const pass = Object.values(checks).every(Boolean);
const out = {
  test: "force:true restart smoke",
  task: 105,
  ts: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  simulation_id: SIM,
  request: { platform: "parallel", max_rounds: 1, force: true },
  method: pass ? "force" : "state.json-workaround",
  pass,
  checks,
  evidence: {
    actionsLinesBefore: before.length,
    actionsLinesJustAfterStart: linesAfterStart,
    actionsLinesAtEnd: after.length,
    previousSimulationEnd: lastEnd ? localToIso(lastEnd.timestamp) : null,
    newSimulationEnd: localToIso(end.timestamp),
    newRunActions: end.total_actions,
    startResponse: { runner_status: started.runner_status, force_restarted: started.force_restarted },
    runStatusDuringRun: statusRunning.runner_status,
    runStatusAfterClose: { runner_status: statusDone.runner_status, started_at: localToIso(statusDone.started_at), current_round: statusDone.current_round, total_actions_count: statusDone.total_actions_count },
    closeEnv: closed.ok ? "ok" : closed.d,
    wall_s: +wall.toFixed(1),
    cost_usd: +(u1 - u0).toFixed(6),
  },
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
logCost({ event: "run", label: "task 105 force smoke", sim: SIM, cost_usd: out.evidence.cost_usd, wall_s: out.evidence.wall_s });
console.log(JSON.stringify(out, null, 2));
