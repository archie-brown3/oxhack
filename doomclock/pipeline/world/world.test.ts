// The recorder's pure parts: the read-out's input rules, the no-copy identifiers, the shared
// formatter, the clock date and the persona memory. The LLM and MiroFish calls are not tested here.
import assert from "node:assert/strict";
import { test } from "node:test";
import { realIdentifiers, eligible, type Post } from "./readout.ts";
import { formatPeriod, realPeriod } from "./format.ts";
import { date10Year, marketsLine } from "./record.ts";
import { seedPack } from "./step1.ts";
import { fetchGraphWhenDrained, fetchReport, futureProject, graphCounts, rubricPrompt, simulationCreateBody, startBody, summaryFromReport, type Api } from "./loop.ts";
import type { WorldEvent } from "../../web/src/contracts.ts";

const post = (o: Partial<Post>): Post => ({ id: 1, uid: 8, round: 1, text: "An order was issued today.", quote: null, original: null, likes: 0, shares: 0, ...o });

test("read-out input: round >= 1, no seeds, no Markets desk, no bare reposts, quoter's own text", () => {
  const got = eligible([
    post({ id: 1, round: 0 }), post({ id: 2, seed: "carry_over" }), post({ id: 3, uid: 26 }),
    post({ id: 4, original: 9, text: "the original's text", quote: null }),
    post({ id: 5, original: 9, text: "the original's text", quote: "my own words about this order" }),
    post({ id: 6 }),
  ]);
  assert.deepEqual(got.map((p) => p.id), [5, 6]);
  assert.equal(got[0].own, "my own words about this order");
});

test("no-copy identifiers: real order numbers are found, SIM numbers are not", () => {
  const res = realIdentifiers(["Executive Order 14179 was signed", "Commission Decision C(2025) 4567", "Incident SIM-2027-3"]);
  assert.ok(res.some((r) => r.test("It follows EO 14179 closely")));
  assert.ok(!res.some((r) => r.test("Incident SIM-2027-3: a lab agent")));
});

test("the formatter: top 3 per kind, major first, plus the count line; real period is 182 days", () => {
  const ev = (i: number, kind: WorldEvent["kind"], major = false): WorldEvent => ({ ts: `2026-0${(i % 9) + 1}-10T00:00:00Z`, provenance: "real", kind, source: "x", title: `T${i}`, major });
  const events = [...Array.from({ length: 6 }, (_, i) => ev(i, "incident", i === 2)), ev(7, "government")];
  const f = formatPeriod(events, 200);
  assert.equal(Object.keys(f.ids).length, 4);
  assert.match(f.text, /E1 .*T2/);
  assert.match(f.text, /About 200 AI incidents this period/);
  const p = realPeriod([{ ...ev(1, "incident"), ts: "2025-01-01T00:00:00Z" }, { ...ev(2, "incident"), ts: "2026-09-01T00:00:00Z" }], "2026-10-24T00:00:00Z");
  assert.equal(p.events.length, 1);
});

test("date10Year: deterministic, later when catastrophe odds fall, no crash after the 2030 knot", () => {
  const a = { asi2030: 0.36, asi2040: 0.75, asi2100: 0.86, cat2100: 0.3 };
  assert.equal(date10Year(a, 2027), date10Year(a, 2027));
  assert.ok(date10Year({ ...a, cat2100: 0.2 }, 2027) > date10Year(a, 2027));
  assert.ok(Number.isFinite(date10Year(a, 2030.1)));
});

test("Amendments 2: one project per future, graph memory on, report files named", async () => {
  const p = futureProject({ future: 1, project_id: "proj_a", graph_id: "mirofish_a" }, 1);
  assert.deepEqual(simulationCreateBody(p), { project_id: "proj_a", graph_id: "mirofish_a", enable_twitter: true, enable_reddit: false });
  assert.equal(startBody("sim_1", 5).enable_graph_memory_update, true);
  assert.throws(() => futureProject({ project_id: "proj_a" }, 1));
  assert.throws(() => futureProject({ future: 2, project_id: "proj_a", graph_id: "g" }, 1));

  const calls: string[] = [];
  let polls = 0;
  const api: Api = async (method, path) => {
    calls.push(`${method} ${path}`);
    if (path === "/api/report/generate") return { task_id: "t1", status: "generating" };
    if (path === "/api/report/generate/status") return ++polls >= 2 ? { status: "completed", report_id: "rep_1" } : { status: "processing" };
    if (path.endsWith("/agent-log")) return { lines: 1 };
    if (path.endsWith("/console-log")) return { lines: 2 };
    return { markdown_content: "## Quiet\n\nA lab paused." };
  };
  const got = await fetchReport(api, "sim_1", async () => {});
  assert.equal(got.report_id, "rep_1");
  assert.deepEqual(calls, [
    "POST /api/report/generate",
    "POST /api/report/generate/status",
    "POST /api/report/generate/status",
    "GET /api/report/by-simulation/sim_1",
    "GET /api/report/rep_1/agent-log",
    "GET /api/report/rep_1/console-log",
  ]);
  assert.equal(summaryFromReport(got.report.markdown_content), "Quiet A lab paused.");
  assert.match(rubricPrompt("Risk is 40%.", "E1 a pause"), /do not treat figures/);
  assert.match(rubricPrompt("Risk is 40%.", "E1 a pause"), /E1 a pause/);
});

test("Zep drain: a pending graph is not saved; two settled reads with the same counts are", async () => {
  const busy = { node_count: 10, edge_count: 4, pending: 3 };
  const calm = { node_count: 12, edge_count: 5, pending: 0 };
  assert.equal(graphCounts(busy)?.busy, true);
  assert.equal(graphCounts(calm)?.busy, false);
  const seen: unknown[] = [];
  let n = 0;
  const api: Api = async () => { const g = [busy, calm, { ...calm }][n++] ?? calm; seen.push(g); return g; };
  const saved = await fetchGraphWhenDrained(api, "mirofish_a", async () => {}, 5);
  assert.equal((saved as { node_count: number }).node_count, 12);
  assert.equal(seen.length, 3);
  await assert.rejects(() => fetchGraphWhenDrained(async () => busy, "mirofish_a", async () => {}, 2), /still processing/);
});

test("seed pack: under 12 KB, current odds, and only events from before today", () => {
  const pack = seedPack();
  assert.ok(pack.length <= 12_000, `pack is ${pack.length} chars`);
  assert.ok(pack.length > 2_000);
  const asOf = pack.match(/before (\d{4}-\d{2}-\d{2})/)?.[1];
  assert.ok(asOf);
  const dated = [...pack.matchAll(/^- (\d{4}-\d{2}-\d{2})/gm)].map((m) => m[1]);
  assert.ok(dated.length >= 10);
  assert.ok(dated.every((d) => d < asOf!));
  assert.match(pack, /catastrophe by 2100: \d/);
  assert.equal(pack.split("## Actors")[1].trim().split("\n").filter((l) => l.startsWith("- ")).length, 32);
  // The stalled build was 115 episodes from 38,280 chars. This scales under that.
  assert.ok(Math.round(115 * (pack.length / 38280)) <= 40);
});

test("MARKETS NOW carries the anchors, their change and the clock", () => {
  const a = { asi2030: 0.36, asi2040: 0.75, asi2100: 0.86, cat2100: 0.3 };
  const m = marketsLine(a, { ...a, asi2030: 0.34 }, 2032.5, "Quiet period.");
  assert.match(m, /by 2030\) 36% \(\+2 pts\)/);
  assert.match(m, /1-in-10 date: Jul 2032/);
  assert.match(m, /not live prices/);
});
