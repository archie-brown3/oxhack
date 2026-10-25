import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { marketCurve, msToYear, readClock, yearToIso } from "./index.ts";
import type { World } from "../contracts.ts";

const read = (u: URL) => JSON.parse(readFileSync(u, "utf8")) as World;
const worlds: [string, World][] = [["fixture", read(new URL("./fixtures/world.fixture.json", import.meta.url))]];
const shipped = new URL("../../public/cache/world.json", import.meta.url);
if (existsSync(shipped)) worlds.push(["public/cache/world.json", read(shipped)]);

const day = (y: number | null) => (y === null ? null : yearToIso(y).slice(0, 10));

for (const [name, world] of worlds) {
  const at = msToYear(Date.parse(world.asOf));
  const c = marketCurve(world.anchors, at, world.lagMeanYears);
  const clock = readClock(world);

  test(`${name}: the chart's 1-in-10 crossing is the clock's date10, and its band the clock's lag range`, () => {
    assert.ok(c.y10 !== null && clock.date10 !== null);
    assert.equal(day(c.y10), clock.date10!.slice(0, 10));
    assert.deepEqual(c.y10Lag.map(day), clock.date10RangeBy.lag.map((d) => d && d.slice(0, 10)));
  });

  test(`${name}: the curves start at 0 today, pass through the market points and cross 1 in 10 at y10`, () => {
    assert.equal(c.asi[0].year, at);
    assert.equal(c.asi[0].p, 0);
    assert.equal(c.cat[0].p, 0);
    for (const pt of c.points.filter((p) => p.curve === "asi")) {
      const on = c.asi.find((d) => d.year === pt.year);
      assert.ok(on && Math.abs(on.p - pt.p) < 1e-9, `${pt.id} is on the curve`);
    }
    const end = c.cat.at(-1)!;
    assert.equal(end.year, 2100);
    assert.equal(end.p, clock.pCat2100);
    assert.ok(Math.abs(end.p - world.anchors.cat2100) < 0.01, "cat2100 within 1 pt (the lag tail past 2100)");
    assert.ok(c.cat.every((d) => (d.year < c.y10! ? d.p < 0.1 : d.p >= 0.1)));
  });
}
