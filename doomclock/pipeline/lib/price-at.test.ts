// Run: node --test doomclock/pipeline/lib/price-at.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { priceAt, type Point } from "./price-at.ts";

// Mixed formats on purpose. As strings "…00.500Z" sorts before "…00Z", the reverse of their time order.
const series: Point[] = [
  { ts: "2025-01-01T23:59:59.000Z", p: 0.1 },
  { ts: "2025-01-02T23:59:59Z", p: 0.2 },
  { ts: "2025-01-03T12:00:00Z", p: 0.3 },
  { ts: "2025-01-03T12:00:00.500Z", p: 0.4 },
  { ts: "2025-01-05T00:00:00Z", p: 0.999 }, // poison: after every T below
].map((r) => ({ t: Date.parse(r.ts), p: r.p })).sort((a, b) => a.t - b.t);

test("returns the last price before T, carried forward", () => {
  assert.deepEqual(priceAt(series, "2025-01-02T06:00:00Z"), { p: 0.1, ts: "2025-01-01T23:59:59Z" });
  assert.equal(priceAt(series, "2025-01-03T00:00:00Z")?.p, 0.2);
});

test("excludes a row exactly at T, whatever the format", () => {
  assert.equal(priceAt(series, "2025-01-02T23:59:59Z")?.p, 0.1);
  assert.equal(priceAt(series, "2025-01-02T23:59:59.000Z")?.p, 0.1);
  assert.equal(priceAt(series, "2025-01-01T23:59:59Z"), null); // row is "…59.000Z": a string compare would keep it
});

test("never returns the poison row after T", () => {
  for (const T of ["2025-01-04T23:59:59Z", "2025-01-04T23:59:59.999Z", "2025-01-05T00:00:00.000Z"])
    assert.equal(priceAt(series, T)?.p, 0.4, T);
});

test("returns null before the first row", () => {
  assert.equal(priceAt(series, "2024-12-31T00:00:00Z"), null);
  assert.equal(priceAt([], "2025-01-03T00:00:00Z"), null);
});

test("orders mixed ms and no-ms timestamps by time", () => {
  assert.equal(priceAt(series, "2025-01-03T12:00:00.250Z")?.p, 0.3);
  assert.equal(priceAt(series, "2025-01-03T12:00:01Z")?.p, 0.4); // a string sort would put 0.3 last
});
