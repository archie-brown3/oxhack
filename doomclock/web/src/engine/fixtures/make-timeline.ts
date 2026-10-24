// Regenerates timeline.fixture.json: buildTimeline(world.fixture.json, Early). Run from doomclock/web:
//   node src/engine/fixtures/make-timeline.ts
// timeline.test.ts fails until it is rerun after an engine change.
import { readFileSync, writeFileSync } from "node:fs";
import { buildTimeline, PICKS } from "../index.ts";

const world = JSON.parse(readFileSync(new URL("./world.fixture.json", import.meta.url), "utf8"));
const timeline = buildTimeline(world, { percentile: PICKS.early });
// Pretty, but one line per event.
let s = JSON.stringify(timeline, (k, v) => (k === "events" ? v.map((e: object) => `@@${JSON.stringify(e)}@@`) : v), 2);
s = s.replace(/"@@(.*?)@@"/g, (_, x) => JSON.parse(`"${x}"`));
writeFileSync(new URL("./timeline.fixture.json", import.meta.url), s + "\n");
console.log(`timeline.fixture.json: future #${timeline.future.id}, ${timeline.frames.length} frames`);
