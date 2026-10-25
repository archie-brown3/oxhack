// Run: node --test doomclock/pipeline/backtest/
import assert from "node:assert/strict";
import { test } from "node:test";
import { blend, bootstrapCI, brier, pickW, reliability, splitByDate } from "./score.ts";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("Brier on a hand-made fixture", () => {
  // (0.9-1)² + (0.2-0)² + (0.6-0)² + (0.5-1)² = 0.01 + 0.04 + 0.36 + 0.25 = 0.66, / 4
  close(brier([0.9, 0.2, 0.6, 0.5], [1, 0, 0, 1]), 0.165);
  close(brier([0.5, 0.5, 0.5], [1, 0, 1]), 0.25); // a coin always scores 0.25
  close(brier([1, 0], [1, 0]), 0);
  assert.throws(() => brier([], []));
});

test("bootstrap CI is seeded, brackets the estimate, and resamples whole clusters", () => {
  const p = [0.9, 0.8, 0.2, 0.1, 0.7, 0.3], y = [1, 1, 0, 0, 0, 1];
  const groups = ["a", "a", "b", "b", "c", "c"];
  const stat = (idx: number[]) => brier(idx.map((i) => p[i]), idx.map((i) => y[i]));
  const ci = bootstrapCI(groups, stat, 500, 7);
  assert.deepEqual(ci, bootstrapCI(groups, stat, 500, 7));
  const est = brier(p, y);
  assert.ok(ci[0] <= est && est <= ci[1], `${ci} around ${est}`);
  // One cluster only: every resample is that cluster, so the CI collapses to the estimate.
  const one = bootstrapCI(["x", "x", "x"], (idx) => idx.length, 50);
  assert.deepEqual(one, [3, 3]);
});

test("reliability bins: equal width, empty bins dropped, p = 1 in the top bin", () => {
  const bins = reliability([0.05, 0.08, 0.55, 1], [0, 1, 1, 1]);
  assert.deepEqual(bins.map((b) => [b.lo, b.n]), [[0, 2], [0.5, 1], [0.9, 1]]);
  close(bins[0].meanForecast, 0.065);
  close(bins[0].observed, 0.5);
});

test("w: blend formula, picked on train only, ties go to the smaller w", () => {
  close(blend(0.4, 0.8, 0.5), 0.6);
  assert.equal(blend(0.9, 2, 1), 1);
  // LLM always right: w = 1 wins.
  assert.equal(pickW([0.5, 0.5], [1, 0], [1, 0], [0, 0.5, 1]).w, 1);
  // LLM equals market: every w ties, so 0.
  assert.equal(pickW([0.3, 0.7], [0.3, 0.7], [0, 1], [0, 0.5, 1]).w, 0);
});

test("date split: train resolved before the cut, test forecast on or after it, gap used by neither", () => {
  const rows = [1, 2, 3, 4, 5, 6].map((t) => ({ t, resolved: t + 1.5 }));
  const { train, test, gap, cut } = splitByDate(rows);
  assert.equal(cut, 4);
  assert.deepEqual(train.map((r) => r.t), [1, 2]); // t = 3 resolves at 4.5, after the cut
  assert.deepEqual(test.map((r) => r.t), [4, 5, 6]);
  assert.equal(gap, 1);
  for (const a of train) for (const b of test) assert.ok(a.resolved < b.t);
});
