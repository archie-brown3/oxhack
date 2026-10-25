// data/events.json: the real WorldEvents (contracts.ts) behind the globe pings, the ticker and the MiroFish seed,
// from asOf(T).events() (doomclock/pipeline/asof). See docs/data/events.md.
// Run: node doomclock/pipeline/events/build-events.ts [--asOf=ISO]   (plain node, no deps, no network)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { asOf, CLEAN, WINDOW_START } from "../asof/asof.ts";
import type { WorldEvent } from "../../web/src/contracts.ts";

const arg = process.argv.find((a) => a.startsWith("--asOf="))?.slice(7);
const file = asOf(arg ?? Date.now()).eventsFile();
const { events } = file;
writeFileSync(join(CLEAN, "../events.json"), JSON.stringify(file, null, 2) + "\n");

const count = (k: keyof WorldEvent) => events.reduce<Record<string, number>>((m, e) => ((m[String(e[k] ?? "none")] = (m[String(e[k] ?? "none")] ?? 0) + 1), m), {});
console.log(`events.json: ${events.length} events, ${WINDOW_START} <= ts < ${file.asOf}`);
for (const k of ["source", "kind", "region", "major"] as const) console.log(k, count(k));
console.log("with who", events.filter((e) => e.who).length, "where", events.filter((e) => e.where).length, "detail", events.filter((e) => e.detail).length);
