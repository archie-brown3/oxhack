// Run: node --test doomclock/pipeline/backtest/
// The price-at-T lookup as the backtest uses it, on a hand-made fixture with poison rows after T.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPool, type Rec } from "./pool.ts";

const id = "manifold:q1";
const base: Rec[] = [
  { kind: "market", id, ts: "2025-01-01T00:00:00Z", question: "Will X happen?", traders: 50, url: "u" },
  { kind: "price", id, ts: "2025-05-30T23:59:59Z", p: 0.3 },
  { kind: "price", id, ts: "2025-06-01T23:59:59Z", p: 0.4 }, // last price before T
  { kind: "price", id, ts: "2025-06-02T00:00:00Z", p: 0.97 }, // poison: exactly at T, excluded
  { kind: "price", id, ts: "2025-06-20T23:59:59Z", p: 0.99 }, // poison: after T
  { kind: "resolution", id, ts: "2025-07-02T00:00:00Z", result: "YES" }, // T = 2025-06-02T00:00:00Z
];

test("T is resolution − 30 days and the price is the last one strictly before T", () => {
  const { questions } = buildPool("manifold", base);
  assert.equal(questions.length, 1);
  const q = questions[0];
  assert.equal(q.T, "2025-06-02T00:00:00Z");
  assert.deepEqual(q.market, { p: 0.4, ts: "2025-06-01T23:59:59Z" });
  assert.equal(q.y, 1);
  assert.ok(Date.parse(q.market.ts) < q.t && q.t < q.resolved);
});

test("filters: thin Manifold markets, T before cutoff + 1 month, no price before T, not YES/NO", () => {
  const thin = base.map((r) => (r.kind === "market" ? { ...r, traders: 19 } : r));
  assert.deepEqual(buildPool("manifold", thin).dropped, { "under 20 traders": 1 });
  const early = base.map((r) => (r.kind === "resolution" ? { ...r, ts: "2025-03-20T00:00:00Z" } : r));
  assert.deepEqual(buildPool("manifold", early).dropped, { "T before model cutoff + 1 month": 1 });
  const noPrice = base.filter((r) => r.kind !== "price" || Date.parse(r.ts) >= Date.parse("2025-06-02T00:00:00Z"));
  assert.deepEqual(buildPool("manifold", noPrice).dropped, { "no price before T": 1 });
  const mkt = base.map((r) => (r.kind === "resolution" ? { ...r, result: "MKT" } : r));
  assert.deepEqual(buildPool("manifold", mkt).dropped, { "not YES/NO": 1 });
});

test("Kalshi: the strike goes into the question text, and a ladder is one bootstrap cluster", () => {
  const k = (t: string) => `kalshi:${t}`;
  const recs: Rec[] = ["A", "B"].flatMap((s) => [
    { kind: "market", id: k(s), ts: "2025-01-01T00:00:00Z", title: "Share above?", subtitle: `Above ${s}`, event: "EV1" },
    { kind: "price", id: k(s), ts: "2025-05-01T00:00:00Z", p: 0.2 },
    { kind: "resolution", id: k(s), ts: "2025-07-02T00:00:00Z", result: "NO" },
  ]);
  const { questions } = buildPool("kalshi", recs);
  assert.deepEqual(questions.map((q) => q.question), ["Share above? (Above A)", "Share above? (Above B)"]);
  assert.deepEqual(new Set(questions.map((q) => q.group)), new Set(["kalshi:EV1"]));
});
