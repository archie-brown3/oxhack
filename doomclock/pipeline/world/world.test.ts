// The recorder's pure parts: the read-out's input rules, the no-copy identifiers, the shared
// formatter, the clock date and the persona memory. The LLM and MiroFish calls are not tested here.
import assert from "node:assert/strict";
import { test } from "node:test";
import { realIdentifiers, eligible, type Post } from "./readout.ts";
import { formatPeriod, realPeriod } from "./format.ts";
import { date10Year, marketsLine } from "./record.ts";
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

test("MARKETS NOW carries the anchors, their change and the clock", () => {
  const a = { asi2030: 0.36, asi2040: 0.75, asi2100: 0.86, cat2100: 0.3 };
  const m = marketsLine(a, { ...a, asi2030: 0.34 }, 2032.5, "Quiet period.");
  assert.match(m, /by 2030\) 36% \(\+2 pts\)/);
  assert.match(m, /1-in-10 date: Jul 2032/);
  assert.match(m, /not live prices/);
});
