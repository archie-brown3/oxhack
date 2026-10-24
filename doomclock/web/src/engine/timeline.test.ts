import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildTimeline, FUTURES, PICKS, readClock, worldFrom } from "./index.ts";
import { simPaths } from "./sim.ts";
import type { AnchorQuarter, NodeId, Timeline, World } from "../contracts.ts";

const read = (u: URL) => JSON.parse(readFileSync(u, "utf8"));
const world: World = read(new URL("./fixtures/world.fixture.json", import.meta.url));
const asOf = Date.parse(world.asOf);
const pick = (w: World, p: number) => buildTimeline(w, { percentile: p });
const early = pick(world, PICKS.early);
const typical = pick(world, PICKS.typical);
const late = pick(world, PICKS.late);
const days = (iso: string) => Date.parse(iso) / 864e5;
const date10 = (w: World) => Date.parse(readClock(w).date10!);
const withAnchor = (id: NodeId, p: number): World => ({ ...world, anchors: { ...world.anchors, [id]: p } });
const events = (t: Timeline) => t.frames.flatMap((f) => f.events);
const decYear = (ms: number) => {
  const y = new Date(ms).getUTCFullYear();
  return y + (ms - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
};

test("deterministic: the same pick gives the same timeline; a timeline is a function of its future", () => {
  assert.deepEqual(buildTimeline(world, { seed: 7 }), buildTimeline(world, { seed: 7 }));
  const a = buildTimeline(world, { seed: 7 });
  const b = buildTimeline(world, { seed: 8 });
  assert.notEqual(a.future.id, b.future.id);
  assert.deepEqual(pick(world, a.future.percentile), a);
  assert.deepEqual(pick(world, PICKS.early), early);
  assert.throws(() => pick(world, 1.5));
  assert.throws(() => buildTimeline(world, { seed: NaN }));
});

test("frames are contiguous quarters 2024Q4..2035Q4, events inside them and in order", () => {
  const f = typical.frames;
  assert.equal(f.length, 45);
  assert.equal(f[0].quarter, "2024Q4");
  assert.equal(f.at(-1)!.quarter, "2035Q4");
  for (let k = 0; k < f.length; k++) {
    const start = Date.UTC(2024, 9 + 3 * k, 1);
    const end = Date.UTC(2024, 12 + 3 * k, 1);
    assert.equal(Date.parse(f[k].start), start, f[k].quarter);
    const ts = f[k].events.map((e) => Date.parse(e.ts));
    assert.ok(ts.every((t, i) => t >= start && t < end && (i === 0 || t >= ts[i - 1])), f[k].quarter);
  }
});

test("real/projected split at asOf: nothing at or after asOf is shown as real", () => {
  for (const f of typical.frames) assert.equal(f.provenance, Date.parse(f.start) < asOf ? "real" : "projected");
  const real = events(typical).filter((e) => e.provenance === "real");
  assert.ok(real.every((e) => Date.parse(e.ts) < asOf));
  assert.ok(events(typical).filter((e) => e.provenance === "projected").every((e) => Date.parse(e.ts) >= asOf));
  assert.equal(real.length, world.events.length);

  // A poisoned event after asOf, and an earlier asOf: the split moves and nothing leaks.
  const poison = { ...world.events[0], ts: "2026-11-01T00:00:00Z", title: "POISON" };
  const earlier: World = { ...world, asOf: "2026-02-15T00:00:00Z", events: [...world.events, poison] };
  const t = pick(earlier, PICKS.typical);
  assert.deepEqual(
    t.frames.filter((f) => f.provenance === "real").map((f) => f.quarter),
    ["2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1"],
  );
  assert.ok(!events(t).some((e) => e.title.includes("POISON")));
  assert.ok(events(t).filter((e) => e.provenance === "real").every((e) => e.ts < "2026-02-15"));
});

test("capability is the Kalshi curve, cummax'd; regions are the normalised weights", () => {
  const curve = new Map(world.capabilityCurve.quarters.map((x) => [x.q, x.p]));
  let max = 0;
  for (const f of typical.frames) {
    max = Math.max(max, curve.get(f.quarter) ?? max);
    assert.equal(f.capability, max, f.quarter);
    assert.ok(Math.abs(f.regions.US + f.regions.China + f.regions.rest - 1) < 1e-12);
  }
  const shuffled: World = { ...world, capabilityCurve: { ...world.capabilityCurve, quarters: [{ q: "2027Q1", p: 0.5 }, { q: "2027Q2", p: 0.3 }] } };
  const caps = pick(shuffled, 0.5).frames.map((f) => f.capability);
  assert.ok(caps.every((c, i) => i === 0 || c >= caps[i - 1]), "monotone even when the curve is not");
});

test("pCat: 0 for quarters already over, rising, and date10 lands in the first frame past 1 in 10", () => {
  const f = typical.frames;
  for (const x of f) if (Date.UTC(2024, 9, 1) <= Date.parse(x.start) && Date.parse(x.start) < Date.UTC(2026, 9, 1)) assert.equal(x.pCat, 0, x.quarter);
  assert.ok(f.every((x, i) => i === 0 || x.pCat >= f[i - 1].pCat));
  const k = f.findIndex((x) => x.pCat >= 0.1);
  const d = Date.parse(typical.clock.date10!);
  assert.ok(Date.parse(f[k].start) <= d && d < Date.parse(f[k + 1].start), `${f[k].quarter} vs ${typical.clock.date10}`);
});

test("the 10,000 futures sample the CDF the clock reads: shares agree within 0.01 every quarter", () => {
  const a = world.anchors;
  const input = {
    startYear: decYear(asOf),
    asi: [{ year: 2030, p: a.asi2030 }, { year: 2040, p: a.asi2040 }, { year: 2100, p: a.asi2100 }],
    pCat2100: a.cat2100,
    lagMeanYears: world.lagMeanYears,
  };
  const { cat } = simPaths(input, { seed: 1, paths: FUTURES }).paths;
  for (let k = 0; k < typical.frames.length; k++) {
    const end = decYear(Date.UTC(2024, 12 + 3 * k, 1));
    const share = cat.filter((c) => c <= end).length / FUTURES;
    assert.ok(Math.abs(share - typical.frames[k].pCat) < 0.01, `${typical.frames[k].quarter}: ${share} vs ${typical.frames[k].pCat}`);
  }
});

test("readClock: date10 to the day, inside its ranges, minutes = years to it; every timeline carries it", () => {
  const c = readClock(world);
  assert.match(c.date10!, /T00:00:00Z$/);
  const [lo, hi] = c.date10Range;
  for (const [a, b] of [c.date10RangeBy.lag, c.date10RangeBy.market]) {
    assert.ok(lo! <= a! && a! <= c.date10! && c.date10! <= b! && b! <= hi!, JSON.stringify(c));
  }
  assert.ok(Math.abs(c.minutesToMidnight! - (decYear(Date.parse(c.date10!)) - decYear(asOf))) < 1e-9);
  assert.ok(Math.abs(c.pCat2100 - 0.3) < 0.02, `${c.pCat2100}`);
  for (const t of [early, typical, late]) assert.deepEqual(t.clock, c);
});

test("date10 moves monotonically with each anchor", () => {
  const d = date10(world);
  for (const id of ["asi2030", "asi2040", "cat2100"] as NodeId[]) {
    assert.ok(date10(withAnchor(id, world.anchors[id] + 0.05)) < d, `${id} up -> earlier`);
    assert.ok(date10(withAnchor(id, world.anchors[id] - 0.05)) > d, `${id} down -> later`);
  }
  // asi2100 raises P(ASI by 2100), so p_bad = cat2100 / P(ASI by 2100) falls: later.
  assert.ok(date10(withAnchor("asi2100", world.anchors.asi2100 + 0.05)) > d);
  assert.ok(date10({ ...world, lagMeanYears: 5 }) > d, "longer lag -> later");
});

test("no 1-in-10 crossing by 2100: a null clock, not a crash", () => {
  const safe = withAnchor("cat2100", 0.05);
  const c = readClock(safe);
  assert.equal(c.date10, null);
  assert.equal(c.minutesToMidnight, null);
  assert.ok(Math.abs(c.pCat2100 - 0.05) < 0.005);
  assert.doesNotThrow(() => pick(safe, PICKS.early));
});

test("percentile picks are ordered: early < typical < late, typical ranked over ALL futures", () => {
  const key = (t: Timeline) => [t.future.catDate ?? "9999", t.future.asiDate ?? "9999"].join("|");
  assert.ok(key(early) < key(typical) && key(typical) < key(late), [key(early), key(typical), key(late)].join(" / "));
  assert.deepEqual([early, typical, late].map((t) => t.future.percentile), [0.1, 0.5, 0.9]);
  assert.equal(typical.future.catDate, null, "under 50% doom by 2100, the median future has none");
  assert.ok(early.future.catDate! < "2036", "the early future ends inside the timeline");
  assert.ok(early.future.id >= 1 && early.future.id <= FUTURES);
});

test("projected incidents arrive at the AIID rate and stop at the future's catastrophe", () => {
  const full = typical.frames.filter((f) => Date.parse(f.start) >= asOf);
  const mean = full.reduce((s, f) => s + f.events.length, 0) / full.length;
  assert.ok(Math.abs(mean / world.warningRate.perQuarter - 1) < 0.1, `${mean} per quarter`);
  const projected = events(early).filter((e) => e.provenance === "projected");
  assert.ok(projected.length > 0 && projected.every((e) => e.ts < early.future.catDate! && e.source === "engine" && e.kind === "incident"));
  assert.ok(projected.every((e) => e.title.startsWith("Projected incident, like: ")));
});

test("per-frame clocks: real frames read the quarter's prices; projected frames only count down", () => {
  const f = typical.frames;
  const q = f.find((x) => x.quarter === "2026Q1")!;
  const anchors = Object.fromEntries(
    Object.entries(world.anchorHistory).map(([id, h]) => [id, h.history.find((x) => x.q === "2026Q1")!.p]),
  ) as Record<NodeId, number>;
  assert.equal(q.clock!.date10, readClock({ ...world, asOf: "2026-01-01T00:00:00Z", anchors }).date10);
  assert.notEqual(q.clock!.date10, typical.clock.date10);
  const proj = f.filter((x) => x.provenance === "projected");
  for (let i = 0; i < proj.length; i++) {
    const c = proj[i].clock!;
    assert.deepEqual({ ...c, minutesToMidnight: 0 }, { ...typical.clock, minutesToMidnight: 0 });
    if (i > 0) assert.ok(c.minutesToMidnight! <= proj[i - 1].clock!.minutesToMidnight!);
    assert.ok(c.minutesToMidnight! >= 0);
    if (i > 0) assert.deepEqual([proj[i].drivers, proj[i].timeDays, proj[i].residualDays], [[], 0, 0]);
  }
  // An anchor with no reading for a quarter: that frame has no clock and the next no drivers.
  const gap = structuredClone(world);
  gap.anchorHistory.cat2100.history = gap.anchorHistory.cat2100.history.filter((x) => x.q !== "2025Q2");
  const g = pick(gap, 0.5).frames;
  assert.equal(g[2].clock, null);
  assert.deepEqual([g[2].drivers, g[3].drivers], [[], []]);
});

test("drivers: time + market moves + residual = the change in date10, largest first", () => {
  const f = typical.frames;
  let checked = 0;
  for (let k = 1; k < f.length; k++) {
    const { drivers, timeDays, residualDays } = f[k];
    const total = days(f[k].clock!.date10!) - days(f[k - 1].clock!.date10!);
    const sum = timeDays + residualDays + drivers.reduce((s, d) => s + d.effectDays, 0);
    assert.ok(Math.abs(sum - total) <= 1.5, `${f[k].quarter}: ${sum} vs ${total}`);
    assert.ok(drivers.every((d, i) => i === 0 || Math.abs(d.effectDays) <= Math.abs(drivers[i - 1].effectDays)));
    for (const d of drivers) {
      const h = world.anchorHistory[d.anchorId];
      assert.deepEqual([d.label, d.url, d.traders], [h.question, h.url, h.traders]);
      assert.notEqual(d.from, d.to);
    }
    checked += drivers.length;
  }
  assert.ok(checked > 10, `${checked} drivers`);
});

test("driver signs: only cat2100 rises, so it is the one driver and it points toward midnight", () => {
  const flat = structuredClone(world);
  for (const [id, h] of Object.entries(flat.anchorHistory)) {
    const p0 = h.history[0].p;
    h.history = h.history.map((x: AnchorQuarter) => ({ ...x, p: id === "cat2100" && x.q >= "2025Q3" ? p0 + 0.1 : p0 }));
  }
  const f = pick(flat, 0.5).frames;
  const k = f.findIndex((x) => x.quarter === "2025Q3");
  assert.equal(f[k].drivers.length, 1);
  const d = f[k].drivers[0];
  assert.deepEqual([d.anchorId, d.to - d.from > 0], ["cat2100", true]);
  assert.ok(d.effectDays < -30, `${d.effectDays} days`);
  assert.equal(d.ts, "2025-07-01T00:00:00Z", "no trade ts in the history: when it was read");
  for (const x of f.slice(1, k)) assert.deepEqual(x.drivers, []);
  assert.ok(f.slice(1, 9).every((x) => x.timeDays > 0), "standing still pushes date10 later");
});

test("under 100 ms for 10,000 futures", () => {
  pick(world, 0.5); // warm-up (JIT)
  const time = (fn: () => unknown) => {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
  };
  const build = Math.min(...[0.1, 0.5, 0.9].map((p) => time(() => pick(world, p))));
  const clock = Math.min(...[1, 2, 3].map(() => time(() => readClock(world))));
  assert.ok(build < 100, `buildTimeline ${build.toFixed(1)} ms`);
  assert.ok(clock < 100, `readClock ${clock.toFixed(1)} ms`);
});

test("timeline.fixture.json is buildTimeline(world.fixture.json, Early) (rerun make-timeline.ts)", () => {
  assert.deepEqual(read(new URL("./fixtures/timeline.fixture.json", import.meta.url)), early);
});

test("the timeline builds from the real data files", (t) => {
  const data = new URL("../../../../data/", import.meta.url);
  const names = ["state.json", "market-inputs.json", "signal-inputs.json", "events.json"];
  if (!names.every((n) => existsSync(new URL(n, data)))) return t.skip("data files not built");
  const [state, marketInputs, signalInputs, ev] = names.map((n) => read(new URL(n, data)));
  const markets = read(new URL("../../../pipeline/markets.json", import.meta.url));
  const real = worldFrom({ state, marketInputs, signalInputs, events: ev, markets });
  const tl = pick(real, PICKS.typical);
  assert.equal(tl.frames.length, 45);
  assert.ok(tl.clock.date10 !== null && tl.frames.every((f) => f.clock !== null));
  assert.ok(tl.frames.flatMap((f) => f.drivers).length > 0);
});
