import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mulberry32 } from "./rng.ts";
import { analyticPCat2100, arrivalYear, asiKnots, monotonise, sim } from "./sim.ts";
import type { SimInput, SimResult } from "./sim.ts";
import { fanBand } from "./fanBand.ts";

const fixture: SimInput = JSON.parse(
  readFileSync(new URL("./fixtures/state.fixture.json", import.meta.url), "utf8"),
);
const withoutMs = ({ ms: _ms, ...rest }: SimResult) => rest;
const near = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-12);

test("same seed gives identical output (ms aside); another seed differs", () => {
  assert.deepEqual(withoutMs(sim(fixture, { seed: 7 })), withoutMs(sim(fixture, { seed: 7 })));
  assert.notDeepEqual(withoutMs(sim(fixture, { seed: 7 })), withoutMs(sim(fixture, { seed: 8 })));
});

test("inverse CDF maps each market p to its year", () => {
  const knots = asiKnots(fixture);
  for (const { year, p } of fixture.asi) assert.ok(Math.abs(arrivalYear(knots, p - 1e-12) - year) < 1e-6);
  assert.equal(arrivalYear(knots, 0.9), Infinity);
});

test("sampled arrival CDF hits each market point within 0.01", () => {
  const knots = asiKnots(fixture);
  for (const paths of [10_000, 100_000]) {
    const rand = mulberry32(1);
    const t = Array.from({ length: paths }, () => arrivalYear(knots, rand()));
    for (const { year, p } of fixture.asi) {
      const got = t.filter((x) => x <= year).length / paths;
      assert.ok(Math.abs(got - p) < 0.01, `${paths} paths, ${year}: ${got} vs ${p}`);
    }
  }
});

test("pCat2100 within 1 pt of the analytic value", () => {
  const exact = analyticPCat2100(fixture);
  assert.ok(Math.abs(exact - 0.2981) < 1e-4, `analytic ${exact}`);
  for (const seed of [1, 2, 3, 4, 5]) {
    const got = sim(fixture, { seed }).pCat2100;
    assert.ok(Math.abs(got - exact) < 0.01, `seed ${seed}: ${got} vs ${exact}`);
  }
});

test("outputs are consistent with each other", () => {
  const r = sim(fixture);
  const mix = r.scenarioMix;
  assert.ok(Math.abs(mix.noAsi + mix.asiFine + mix.fastCat + mix.slowCat - 1) < 1e-12);
  assert.ok(Math.abs(mix.fastCat + mix.slowCat - r.pCat2100) < 1e-12);
  assert.ok(Math.abs(mix.noAsi - 0.14) < 0.01);
  assert.equal(r.fan[0].year, 2026);
  assert.equal(r.fan.at(-1)!.year, 2100);
  assert.equal(r.fan.at(-1)!.p, r.pCat2100);
  for (let i = 1; i < r.fan.length; i++) assert.ok(r.fan[i].p >= r.fan[i - 1].p);
  assert.equal(r.p10Year, r.fan.find((f) => f.p >= 0.1)!.year);
  const median = new Date(r.medianCatDate!).getUTCFullYear();
  assert.ok(median > 2026 && median < 2100, r.medianCatDate!);
});

test("10k paths run in under 50 ms", () => {
  sim(fixture); // warm-up (JIT)
  const times = Array.from({ length: 5 }, () => sim(fixture).ms);
  assert.ok(Math.min(...times) < 50, `best of 5: ${Math.min(...times).toFixed(1)} ms`);
});

test("p = 0 everywhere: nothing arrives, nothing goes wrong", () => {
  const r = sim({ ...fixture, asi: fixture.asi.map((a) => ({ ...a, p: 0 })) });
  assert.equal(r.pCat2100, 0);
  assert.equal(r.medianCatDate, null);
  assert.equal(r.p10Year, null);
  assert.equal(r.scenarioMix.noAsi, 1);
});

test("p = 1: ASI certain by 2030 and catastrophe certain by 2100", () => {
  const input = { ...fixture, asi: [{ year: 2030, p: 1 }], pCat2100: 1 };
  const r = sim(input);
  assert.ok(r.pCat2100 > 0.999 && Math.abs(r.pCat2100 - analyticPCat2100(input)) < 0.001);
  assert.equal(r.scenarioMix.noAsi, 0);
});

test("pCat above P(ASI by 2100) clamps p_bad to 1; the pBad override wins", () => {
  const over = { ...fixture, pCat2100: 0.95 };
  assert.ok(Math.abs(analyticPCat2100(over) - analyticPCat2100({ ...fixture, pBad: 1 })) < 1e-12);
  assert.equal(sim({ ...fixture, pBad: 0 }).pCat2100, 0);
});

test("lag mean 0: catastrophe at arrival, all fast", () => {
  const r = sim({ ...fixture, lagMeanYears: 0 });
  assert.equal(r.scenarioMix.slowCat, 0);
  assert.ok(Math.abs(r.pCat2100 - 0.3) < 0.01);
});

test("non-monotone market points are monotonised (pooled), not rejected", () => {
  assert.ok(near(monotonise([0.36, 0.3, 0.86]), [0.33, 0.33, 0.86]));
  assert.ok(near(monotonise([0.5, 0.4, 0.3]), [0.4, 0.4, 0.4]));
  const knots = asiKnots({ ...fixture, asi: [{ year: 2030, p: 0.36 }, { year: 2040, p: 0.3 }] });
  assert.equal(knots.monotonised, true);
  assert.ok(near(knots.ps, [0, 0.33, 0.33]));
  assert.equal(asiKnots(fixture).monotonised, false);
  assert.doesNotThrow(() => sim({ ...fixture, asi: [{ year: 2030, p: 0.5 }, { year: 2040, p: 0.4 }] }));
});

test("malformed input throws", () => {
  const bad: Partial<SimInput>[] = [
    { asi: [{ year: 2040, p: 0.5 }, { year: 2030, p: 0.6 }] }, // years out of order
    { asi: [{ year: 2026, p: 0.1 }] }, // knot not after startYear
    { asi: [{ year: 2030, p: 1.2 }] },
    { asi: [{ year: 2030, p: NaN }] },
    { pCat2100: -0.1 },
    { lagMeanYears: -1 },
    { pBad: 2 },
  ];
  for (const b of bad) assert.throws(() => sim({ ...fixture, ...b }), JSON.stringify(b));
});

test("fan band: p10 <= p50 = p <= p90 every year, under 200 ms", () => {
  const t0 = performance.now();
  const fan = fanBand(fixture);
  const ms = performance.now() - t0;
  assert.ok(ms < 200, `${ms} ms`);
  assert.deepEqual(fan.map((f) => f.p), sim(fixture).fan.map((f) => f.p));
  for (const f of fan) {
    assert.ok(f.p10! <= f.p50! && f.p50 === f.p && f.p50! <= f.p90!, JSON.stringify(f));
  }
  const y2035 = fan.find((f) => f.year === 2035)!;
  assert.ok(y2035.p90! - y2035.p10! > 0.01, "band has width where timing matters");
});
