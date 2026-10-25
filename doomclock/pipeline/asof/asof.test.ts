// Run: node --test doomclock/pipeline/asof/
// The leakage test: nothing with ts >= T ever comes out of asOf(T), across every source and both ISO formats
// ("…00Z" and "…00.000Z") plus epoch numbers. Each fixture source holds rows before T, a row exactly at T and a
// POISON row after T (price 0.999). Then the same property on the real data/clean files at several T.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { asOf, CLEAN, type Source } from "./asof.ts";
import type { MarketsFile } from "../../web/src/contracts.ts";

const T = "2026-01-01T00:00:00Z";
const tT = Date.parse(T);
const POISON = 0.999;
// One row per timing: before T in three formats, exactly at T (".000Z", which a string compare would keep), after T.
const BEFORE = ["2025-11-01T00:00:00Z", "2025-12-01T00:00:00.000Z", Date.parse("2025-12-15T00:00:00Z") / 1000];
const AT = "2026-01-01T00:00:00.000Z";
const AFTER = ["2026-01-01T00:00:00.500Z", "2026-02-01T00:00:00Z"];

const pins: MarketsFile = {
  manifold: [
    ...(["asi2030", "asi2040", "asi2100", "cat2100"] as const).map((node, i) => ({
      id: `m${i}`, role: "anchor" as const, node, horizonYear: [2030, 2040, 2100, 2100][i], label: node, url: `https://m/${i}`, question: `Q ${node}?`, deadline: "2100-01-01T00:00:00Z",
    })),
    { id: "w0", role: "warning", label: "warn", url: "https://m/w", question: "W?", deadline: "2030-01-01T00:00:00Z" },
  ],
  kalshi: [], polymarket: [],
};

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "asof-"));
  const rows: Record<string, object[]> = {};
  const put = (s: string, r: object) => (rows[s] ??= []).push(r);
  const each = (fn: (ts: string | number, ok: boolean, i: number) => void) => {
    BEFORE.forEach((ts, i) => fn(ts, true, i));
    [AT, ...AFTER].forEach((ts, i) => fn(ts, false, i));
  };
  each((ts, ok, i) => {
    const title = ok ? `Item ${i}` : `POISON ${i}`;
    put("aiid", { ts, id: `${ok ? "" : "9"}${i}`, title, description: `${title} happened in London. More.`, deployers: ["openai"], developers: [], n_reports: ok ? 12 : 40, event_date: "2025-10-01" });
    put("government", { ts, source: "federal-register", id: `fr:${i}${ok}`, title: `Commerce Department rule: ${title}`, url: "https://fr", region: "US", issuer: "Commerce Department", doc_type: "Rule" });
    put("wikipedia_ai", { ts, kind: "news", id: `w${i}${ok}`, title: `OpenAI ${title}`, url: "https://wiki" });
    put("doomsday_clock", { ts, id: `${i}${ok}`, url: "https://b", seconds_to_midnight: ok ? 89 : 1 });
    put("world-facts", { ts, id: `f${i}${ok}`, text: `${title} in China`, source: "https://f", url: "https://f" });
    for (const s of ["epoch", "metr", "datacentres", "rss"]) put(s, { ts, id: `${s}${i}${ok}`, title });
    for (let m = 0; m < 4; m++) put("manifold", { ts, kind: "price", id: `manifold:m${m}`, p: ok ? Math.round(100 * (0.1 * (m + 1) + 0.01 * i)) / 100 : POISON });
    put("manifold", { ts, kind: "price", id: "manifold:w0", p: ok ? 0.2 : POISON });
    put("kalshi", { ts, kind: "price", id: "kalshi:KXAGICO-COMP-30", p: ok ? Math.round(100 * (0.3 + 0.01 * i)) / 100 : POISON });
    put("polymarket", { ts, kind: "price", id: "pm:77", p: ok ? 0.4 : POISON });
  });
  // Market rows: created before T (kept) and after T (dropped). A curve knot from a market created after T must not appear.
  for (let m = 0; m < 4; m++) put("manifold", { ts: "2024-01-01T00:00:00Z", kind: "market", id: `manifold:m${m}`, traders: 10 });
  put("kalshi", { ts: "2025-01-01T00:00:00Z", kind: "market", id: "kalshi:KXAGICO-COMP-30", close_time: "2030-01-01T00:00:00Z" });
  put("kalshi", { ts: "2026-01-05T00:00:00Z", kind: "market", id: "kalshi:KXAGICO-COMP-27", close_time: "2027-01-01T00:00:00Z" });
  put("kalshi", { ts: AFTER[1], kind: "price", id: "kalshi:KXAGICO-COMP-27", p: POISON });
  put("aiid", { title: "UNDATED POISON" }); // no ts: dropped
  for (const [s, rs] of Object.entries(rows)) writeFileSync(join(dir, `${s}.jsonl`), rs.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return dir;
}

const dir = fixture();
const a = asOf(T, { clean: dir, markets: pins });
const SOURCES: Source[] = ["aiid", "datacentres", "doomsday_clock", "epoch", "government", "kalshi", "manifold", "metr", "polymarket", "wikipedia_ai", "world-facts", "rss"];
const ms = (v: unknown) => (typeof v === "number" ? (v < 1e11 ? v * 1000 : v) : Date.parse(String(v)));

// Every time-like string anywhere in a value is before T (history T/ts, lastTradeTs, event ts …); asOf itself is T.
function allBefore(v: unknown, path = ""): void {
  if (Array.isArray(v)) return v.forEach((x, i) => allBefore(x, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).forEach(([k, x]) => k !== "asOf" && k !== "deadline" && allBefore(x, `${path}.${k}`));
  if (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) assert.ok(Date.parse(v) <= tT, `${path} = ${v}`);
}

test("records: every source keeps exactly the rows before T, whatever the ts format", () => {
  for (const s of SOURCES) {
    const rs = a.records(s);
    assert.ok(rs.length > 0, s);
    for (const r of rs) assert.ok(ms(r.ts) < tT, `${s} ${r.ts}`);
    assert.ok(!JSON.stringify(rs).includes("POISON"), s);
  }
  assert.equal(a.records("doomsday_clock").length, 3); // the row exactly at T (".000Z") is out
});

test("priceAt: never the row at or after T, in any source", () => {
  assert.equal(a.priceAt("manifold:m0")?.p, 0.12);
  assert.equal(a.priceAt("m0")?.p, 0.12); // bare Manifold id
  assert.equal(a.priceAt("KXAGICO-COMP-30")?.p, 0.32); // bare Kalshi ticker
  assert.equal(a.priceAt("77")?.p, 0.4); // bare Polymarket id
  assert.equal(a.priceAt("pm:77")?.ts, "2025-12-15T00:00:00Z");
  for (const id of ["manifold:w0", "kalshi:KXAGICO-COMP-30", "pm:77", "kalshi:KXAGICO-COMP-27"]) assert.notEqual(a.priceAt(id)?.p, POISON, id);
  assert.equal(a.priceAt("kalshi:KXAGICO-COMP-27"), null);
  for (const p of a.series("manifold:m3")) assert.ok(p.t < tT);
});

test("anchors, history, ranges, warnings, curve, state: no poison price and no time after T", () => {
  const out = { state: a.state(), anchorHistory: a.anchorHistory(), mi: a.marketInputs(), ev: a.eventsFile() };
  assert.ok(!JSON.stringify(out).includes(String(POISON)));
  assert.ok(!JSON.stringify(out).includes("POISON"));
  allBefore(out);
  const n = out.state.nodes;
  assert.deepEqual(n.map((x) => x.pMarket), [0.12, 0.22, 0.32, 0.42]);
  assert.deepEqual(n[0].pRange12m, [0.1, 0.12]);
  assert.equal(n[0].nPrices, 3);
  assert.equal(n[0].lastTradeTs, "2025-12-15T00:00:00Z");
  // 2026Q1 starts exactly at T: its reading is the last close strictly before T, not the row at T.
  assert.deepEqual(n[0].history.at(-1), { q: "2026Q1", T, p: 0.12, ts: "2025-12-15T00:00:00Z" });
  assert.equal(out.state.warnings[0].pMarket, 0.2);
  // One knot from KXAGICO-COMP-30; COMP-27 was created after T and adds none.
  assert.equal(out.mi!.capabilityCurve.quarters.find((q) => q.q === "2029Q4")!.p, 0.32);
});

test("events: window [2024-10-24, T), enriched, never undated or after T", () => {
  const ev = a.events();
  assert.equal(ev.length, 15); // 3 kept rows x 5 event sources
  for (const e of ev) assert.ok(Date.parse(e.ts) < tT && e.provenance === "real", e.title);
  const incident = ev.find((e) => e.source === "aiid")!;
  assert.equal(incident.who, "OpenAI");
  assert.equal(incident.where, "GBR");
  assert.equal(incident.major, true);
  assert.match(incident.detail!, /^Item \d happened in London\. Covered in 12 press reports\.$/);
  const fact = ev.find((e) => e.source === "world-facts")!;
  assert.equal(fact.where, "CHN");
  assert.equal(fact.major, true);
  assert.equal(ev.find((e) => e.source === "federal-register")!.who, "US Commerce Department");
  // sorted by time
  assert.ok(ev.every((e, i) => i === 0 || Date.parse(e.ts) >= Date.parse(ev[i - 1].ts)));
});

test("T is truncated to the second and both formats of T agree", () => {
  assert.equal(asOf("2026-01-01T00:00:00.999Z", { clean: dir, markets: pins }).T, T);
  assert.deepEqual(asOf("2026-01-01T00:00:00.000Z", { clean: dir, markets: pins }).state(), a.state());
  assert.deepEqual(asOf(tT, { clean: dir, markets: pins }).eventsFile(), a.eventsFile());
  assert.throws(() => asOf("not a date"));
});

test("real data/clean: nothing at or after T, at several T", () => {
  for (const t of ["2025-06-01T00:00:00Z", "2026-03-10T12:00:00.000Z", "2026-10-24T20:51:00Z"]) {
    const r = asOf(t);
    for (const s of SOURCES) for (const x of r.records(s)) assert.ok(ms(x.ts) < r.t, `${t} ${s} ${x.ts}`);
    const out = { st: r.state(), ev: r.eventsFile() };
    for (const e of out.ev.events) assert.ok(Date.parse(e.ts) < r.t, e.title);
    allBeforeAt(out, r.t);
  }
  assert.ok(CLEAN.endsWith("data/clean"));
});

function allBeforeAt(v: unknown, t: number, path = ""): void {
  if (Array.isArray(v)) return v.forEach((x, i) => allBeforeAt(x, t, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).forEach(([k, x]) => k !== "asOf" && allBeforeAt(x, t, `${path}.${k}`));
  if (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) assert.ok(Date.parse(v) <= t, `${path} = ${v}`);
}
