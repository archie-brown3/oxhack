// data/events.json: the real WorldEvents (contracts.ts) behind the globe pings and the ticker. See docs/data/events.md.
// Reads data/clean/{aiid,government,wikipedia_ai,doomsday_clock}.jsonl (read-only); only aiid is required.
// Run: node doomclock/pipeline/events/build-events.ts [--asOf=ISO]   (plain node, no deps, no network)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";

type Region = "US" | "China" | "rest";
type WorldEvent = {
  ts: string; kind: "incident" | "government" | "news"; title: string; url?: string;
  source: string; region?: Region; provenance: "real";
};

const DATA = join(RAW, "..");
const START = "2024-10-24T00:00:00Z";
// ISO UTC to the second; sub-second times round up (never earlier than public). null if unparseable.
const iso = (v: unknown) => {
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? new Date(Math.ceil(t / 1000) * 1000).toISOString().replace(".000Z", "Z") : null;
};
const arg = process.argv.find((a) => a.startsWith("--asOf="))?.slice(7);
const asOf = iso(arg ?? new Date().toISOString());
if (!asOf) throw new Error(`bad --asOf ${arg}`);

function load(name: string, required = false): any[] {
  const f = join(DATA, "clean", name);
  if (!existsSync(f)) {
    if (required) throw new Error(`missing ${f}`);
    console.warn(`warning: ${name} missing, skipped`);
    return [];
  }
  return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
const asRegion = (r: unknown) => (r === "US" || r === "China" || r === "rest" ? r : undefined);

// AIID region: title, then description (China, then other countries, then US), then deployers + developers.
// Case-sensitive. (?!\w) ends each term, so "U.S." and "U.K." match before a space (\b would not).
const CN = /\b(China|Chinese|Beijing|Shanghai|Shenzhen)(?!\w)/;
const REST = /\b(UK|U\.K\.|United Kingdom|British|England|London|Ireland|EU|European|Europe|France|French|Germany|German|Italy|Spain|Netherlands|India|Indian|Japan|Japanese|Korea|Korean|Australia|Australian|Canada|Canadian|Brazil|Mexico|Russia|Russian|Ukraine|Israel|Iran|Turkey|Indonesia|Philippines|Pakistan|Nigeria|Kenya|South Africa|Singapore|Malaysia|Vietnam|Thailand|Argentina|Poland|Sweden|Norway|Denmark|Kosovo|Serbia|Romania|Hungary|Greece|Moldova|Taiwan|Hong Kong|Bangladesh|New Zealand|Belgium|Switzerland|Austria|Finland|Portugal|Saudi|UAE|Dubai|Qatar|Egypt)(?!\w)/;
const US = /\b(U\.S\.|US|United States|American|America|California|Texas|New York|Florida|FBI|FTC|Congress|Pentagon|Trump|Biden)(?!\w)/;
const ENTITY: Record<string, Region> = Object.fromEntries([
  ...["openai", "google", "anthropic", "meta", "xai", "microsoft", "amazon", "apple", "waymo", "tesla", "character.ai", "perplexity-ai", "nvidia"].map((e) => [e, "US"]),
  ...["deepseek", "alibaba", "baidu", "bytedance", "tencent", "zhipu-ai", "moonshot-ai", "huawei"].map((e) => [e, "China"]),
]);
function aiidRegion(r: any): Region | undefined {
  for (const t of [r.title ?? "", r.description ?? ""]) {
    if (CN.test(t)) return "China";
    if (REST.test(t)) return "rest";
    if (US.test(t)) return "US";
  }
  for (const e of [...(r.deployers ?? []), ...(r.developers ?? [])]) if (ENTITY[e]) return ENTITY[e];
}

const events: WorldEvent[] = [];
let dropped = 0;
const inWindow = (t: string | null): t is string => !!t && t >= START && t < asOf!;
// Returns the event when it is kept (dated, titled, inside the window).
function add(e: Omit<WorldEvent, "ts" | "provenance">, ts: unknown) {
  const t = iso(ts);
  if (!t || !e.title) { dropped++; return; }
  if (!inWindow(t)) return;
  const ev: WorldEvent = { ts: t, kind: e.kind, title: e.title, url: e.url || undefined, source: e.source, region: e.region, provenance: "real" };
  events.push(ev);
  return ev;
}

for (const r of load("aiid.jsonl", true))
  add({ kind: "incident", source: "aiid", title: r.title, url: `https://incidentdatabase.ai/cite/${r.id}`, region: aiidRegion(r) }, r.ts);

// Only government records kept in the window can absorb a Wikipedia duplicate, so an --asOf build never reads later records.
const byEo = new Map<string, WorldEvent>(), byEurLexDay = new Map<string, WorldEvent>();
for (const r of load("government.jsonl")) {
  const ev = add({ kind: "government", source: r.source, title: r.title, url: r.url, region: asRegion(r.region) }, r.ts);
  if (ev && r.executive_order_number != null) byEo.set(String(r.executive_order_number), ev);
  if (ev && r.source === "eur-lex") byEurLexDay.set(ev.ts.slice(0, 10), ev);
}

// A Wikipedia duplicate of a government record is dropped (the primary source wins), and the kept event takes
// the earlier of the two dates: Wikipedia dates an EO's signing, the Federal Register its later publication.
let deduped = 0;
for (const r of load("wikipedia_ai.jsonl")) {
  const t = iso(r.ts);
  const eo = String(r.title ?? "").match(/\bExecutive Order (\d{5})\b/)?.[1];
  const aiAct = /\b(AI|Artificial Intelligence) Act\b/.test(`${r.title ?? ""} ${r.description ?? ""}`);
  const dup = inWindow(t) ? (eo && byEo.get(eo)) || (aiAct && byEurLexDay.get(t.slice(0, 10))) : undefined;
  if (dup) { if (t! < dup.ts) dup.ts = t!; deduped++; continue; }
  add({ kind: r.kind === "government" ? "government" : "news", source: "wikipedia", title: r.title, url: r.url, region: asRegion(r.region) }, r.ts);
}

for (const r of load("doomsday_clock.jsonl"))
  add({ kind: "news", source: "bulletin", title: `Bulletin of the Atomic Scientists sets the Doomsday Clock to ${r.seconds_to_midnight} seconds to midnight`, url: r.url }, r.ts);

events.sort((a, b) => a.ts.localeCompare(b.ts) || a.source.localeCompare(b.source) || a.title.localeCompare(b.title));
writeFileSync(join(DATA, "events.json"), JSON.stringify({ schema: "doomclock.events/1", asOf, events }, null, 2) + "\n");

const count = (k: keyof WorldEvent) => events.reduce<Record<string, number>>((m, e) => ((m[String(e[k] ?? "none")] = (m[String(e[k] ?? "none")] ?? 0) + 1), m), {});
console.log(`events.json: ${events.length} events, ${START} <= ts < ${asOf}; ${deduped} wikipedia duplicates and ${dropped} undated/untitled records dropped`);
console.log("source", count("source"));
console.log("kind", count("kind"));
console.log("region", count("region"));
