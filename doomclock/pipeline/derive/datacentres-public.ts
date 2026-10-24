// Every publicly known datacentre for the globe: OpenStreetMap (Overpass) + PeeringDB + Wikidata, merged with Epoch's frontier sites.
// Writes data/clean/datacentres-public.jsonl. Epoch's own build (derive/datacentres.ts) and its output are read, never changed.
// Raw responses are cached under data/raw/{osm,peeringdb,wikidata}/ (one copy per day; same-day re-runs reuse them).
// Run: node doomclock/pipeline/derive/datacentres-public.ts   (plain node, no deps; a cold run takes ~10-20 minutes, mostly Overpass pauses)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";

const day = new Date().toISOString().slice(0, 10);
const UA = "oxhack-doomclock/0.1 (hackathon project; contact via GitHub)";
const OUT = join(RAW, "../clean/datacentres-public.jsonl");
const EPOCH = join(RAW, "../clean/datacentres.jsonl");
const COUNTRIES = join(import.meta.dirname, "../../../.lavish/ne_110m_countries.geojson"); // Natural Earth 110m, public domain
const today = new Date().toISOString();

type Region = "US" | "China" | "rest";
type Src = "epoch" | "wikidata" | "peeringdb" | "osm";
interface Pt {
  src: Src; id: string; url: string; ts: string; name: string | null; operator: string | null;
  lat: number; lon: number; cc: string | null; countryName: string | null; extra?: Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const blocked: string[] = [];

async function http(url: string, init: RequestInit = {}, tries = 5): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { ...init, headers: { "user-agent": UA, ...init.headers } });
    if (res.ok) return res;
    if (i + 1 >= tries || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
    await sleep(8000 * 2 ** i);
  }
}
const cached = (source: string, name: string) => join(RAW, source, name);

// ---------- country / region ----------
const names = new Intl.DisplayNames(["en"], { type: "region" });
const ccName = (cc: string) => { try { return names.of(cc.toUpperCase()) ?? null; } catch { return null; } };
const REGION_CHINA = new Set(["CN", "HK", "MO"]); // PRC-administered; Taiwan stays "rest"
const regionOf = (cc: string | null, name: string | null): Region =>
  cc === "US" || name === "United States" ? "US" : (cc && REGION_CHINA.has(cc)) || name === "China" ? "China" : "rest";

type Ring = number[][];
interface Poly { name: string; rings: Ring[]; box: [number, number, number, number] }
const polys: Poly[] = [];
for (const f of JSON.parse(readFileSync(COUNTRIES, "utf8")).features) {
  const name = f.properties.NAME === "United States of America" ? "United States" : f.properties.NAME;
  const parts: Ring[][] = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of parts) {
    const xs = p[0].map((c: number[]) => c[0]), ys = p[0].map((c: number[]) => c[1]);
    polys.push({ name, rings: p, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
}
function inRing(lon: number, lat: number, r: Ring) {
  let o = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i][1] > lat !== r[j][1] > lat && lon < ((r[j][0] - r[i][0]) * (lat - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) o = !o;
  }
  return o;
}
let polyFallback = 0;
function countryFromPoint(lat: number, lon: number): string | null {
  for (const p of polys) {
    if (lon < p.box[0] || lon > p.box[2] || lat < p.box[1] || lat > p.box[3]) continue;
    if (inRing(lon, lat, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(lon, lat, h))) return p.name;
  }
  // 110m coastlines miss the shore: take the nearest vertex within 0.5 degrees
  let best = 0.25, name: string | null = null; // squared degrees
  for (const p of polys) {
    if (lon < p.box[0] - 0.5 || lon > p.box[2] + 0.5 || lat < p.box[1] - 0.5 || lat > p.box[3] + 0.5) continue;
    for (const [x, y] of p.rings[0]) { const d = (x - lon) ** 2 + (y - lat) ** 2; if (d < best) { best = d; name = p.name; } }
  }
  if (name) polyFallback++;
  return name;
}

// ---------- 1. OpenStreetMap via Overpass ----------
// Tiles of 30x30 degrees; any tile that errors or times out is split into four. One query at a time, with pauses.
const OVERPASS = "https://overpass-api.de/api/interpreter";
const osmFailed: string[] = [];
const osmEls = new Map<string, any>();
async function overpassTile(s: number, w: number, n: number, e: number): Promise<void> {
  const key = `tile_${s}_${w}_${n}_${e}.${day}.json`;
  const path = cached("osm", key);
  let body: any;
  if (existsSync(path)) body = JSON.parse(readFileSync(path, "utf8"));
  else {
    const bb = `(${s},${w},${n},${e})`;
    const q = `[out:json][timeout:180][maxsize:1073741824];(nwr["telecom"="data_center"]${bb};nwr["building"="data_center"]${bb};nwr["man_made"="data_center"]${bb};);out center meta;`;
    try {
      await sleep(3000);
      const text = await (await http(OVERPASS, { method: "POST", body: new URLSearchParams({ data: q }) })).text();
      body = JSON.parse(text);
      if (body.remark && /error|timed out|out of memory/i.test(body.remark)) throw new Error(body.remark);
      await saveRaw("osm", key, text);
    } catch (err) {
      if (n - s > 4) {
        console.log(`osm tile ${s},${w},${n},${e} failed (${(err as Error).message.slice(0, 80)}); splitting`);
        const ms = (s + n) / 2, mw = (w + e) / 2;
        for (const [a, b, c, d] of [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]]) await overpassTile(a, b, c, d);
      } else { osmFailed.push(`${s},${w},${n},${e}: ${(err as Error).message.slice(0, 80)}`); }
      return;
    }
  }
  for (const el of body.elements) osmEls.set(`${el.type}/${el.id}`, el);
  if (body.elements.length) console.log(`osm tile ${s},${w},${n},${e}: ${body.elements.length}`);
}

async function loadOsm(): Promise<Pt[]> {
  for (let s = -60; s < 90; s += 30) for (let w = -180; w < 180; w += 30) await overpassTile(s, w, s + 30, w + 30);
  const out: Pt[] = [];
  for (const [k, el] of osmEls) {
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number" || !el.timestamp) continue;
    const t = el.tags ?? {};
    const cc = /^[A-Za-z]{2}$/.test(t["addr:country"] ?? "") ? t["addr:country"].toUpperCase() : null;
    out.push({
      src: "osm", id: k, url: `https://www.openstreetmap.org/${k}`, ts: el.timestamp,
      name: t.name ?? t["name:en"] ?? null, operator: t.operator ?? t.brand ?? t.owner ?? null,
      lat, lon, cc, countryName: cc ? ccName(cc) : null,
    });
  }
  return out;
}

// ---------- 2. PeeringDB (one bulk call) ----------
async function loadPeeringDb(): Promise<Pt[]> {
  const name = `fac.${day}.json`;
  if (!existsSync(cached("peeringdb", name))) await saveRaw("peeringdb", name, await (await http("https://www.peeringdb.com/api/fac")).text());
  const rows = JSON.parse(readFileSync(cached("peeringdb", name), "utf8")).data as any[];
  const out: Pt[] = [];
  for (const r of rows) {
    if (r.status && r.status !== "ok") continue;
    if (typeof r.latitude !== "number" || typeof r.longitude !== "number" || (r.latitude === 0 && r.longitude === 0)) continue;
    const cc = /^[A-Za-z]{2}$/.test(r.country ?? "") ? r.country.toUpperCase() : null;
    out.push({
      src: "peeringdb", id: `fac/${r.id}`, url: `https://www.peeringdb.com/fac/${r.id}`, ts: r.created,
      name: r.name || null, operator: r.org_name || null, lat: r.latitude, lon: r.longitude, cc, countryName: cc ? ccName(cc) : null,
    });
  }
  return out;
}

// ---------- 3. Wikidata SPARQL (+ item creation time from the MediaWiki API) ----------
async function loadWikidata(): Promise<Pt[]> {
  const sparql = `SELECT ?i ?iLabel ?c ?inc ?cc ?opLabel WHERE {
    ?i wdt:P31/wdt:P279* wd:Q671224; wdt:P625 ?c.
    OPTIONAL { ?i wdt:P571 ?inc } OPTIONAL { ?i wdt:P17/wdt:P297 ?cc }
    OPTIONAL { ?i wdt:P137|wdt:P127 ?op }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
  }`;
  const name = `sparql.${day}.json`;
  if (!existsSync(cached("wikidata", name)))
    await saveRaw("wikidata", name, await (await http("https://query.wikidata.org/sparql?" + new URLSearchParams({ query: sparql }), { headers: { accept: "application/sparql-results+json" } })).text());
  const rows = JSON.parse(readFileSync(cached("wikidata", name), "utf8")).results.bindings as any[];
  const items = new Map<string, { label: string | null; lat: number; lon: number; inc: string | null; cc: string | null; op: string | null }>();
  for (const b of rows) {
    const q = b.i.value.split("/").pop() as string;
    const m = /Point\(([-\d.e]+) ([-\d.e]+)\)/.exec(b.c.value);
    if (!m || items.has(q)) { if (items.has(q) && b.opLabel && !items.get(q)!.op) items.get(q)!.op = b.opLabel.value; continue; }
    const label = b.iLabel?.value;
    items.set(q, {
      label: label && !/^Q\d+$/.test(label) ? label : null, lon: +m[1], lat: +m[2],
      inc: b.inc?.value?.startsWith("-") ? null : (b.inc?.value ?? null), cc: b.cc?.value ?? null,
      op: b.opLabel && !/^Q\d+$/.test(b.opLabel.value) ? b.opLabel.value : null,
    });
  }
  // item creation = timestamp of the first revision; cached as one raw file
  const cpath = cached("wikidata", `created.${day}.json`);
  const created: Record<string, string | null> = existsSync(cpath) ? JSON.parse(readFileSync(cpath, "utf8")) : {};
  for (const q of items.keys()) {
    if (q in created) continue;
    await sleep(300);
    try {
      const j = await (await http(`https://www.wikidata.org/w/api.php?action=query&format=json&prop=revisions&rvlimit=1&rvdir=newer&rvprop=timestamp&titles=${q}`)).json() as any;
      created[q] = (Object.values(j.query.pages)[0] as any).revisions?.[0]?.timestamp ?? null;
    } catch { created[q] = null; }
  }
  await saveRaw("wikidata", `created.${day}.json`, JSON.stringify(created));
  const out: Pt[] = [];
  for (const [q, it] of items) {
    // ts = the LATER of inception and item creation (conservative: never earlier than when Wikidata or the site itself existed); future inceptions ignored
    const inc = it.inc && it.inc.slice(0, 10) <= today.slice(0, 10) ? new Date(it.inc).toISOString() : null;
    const ts = [inc, created[q]].filter((x): x is string => !!x).sort().at(-1);
    if (!ts) continue;
    out.push({
      src: "wikidata", id: q, url: `https://www.wikidata.org/wiki/${q}`, ts, name: it.label, operator: it.op,
      lat: it.lat, lon: it.lon, cc: it.cc?.toUpperCase() ?? null, countryName: it.cc ? ccName(it.cc) : null,
    });
  }
  return out;
}

// ---------- 4. Epoch (existing clean file, unchanged) ----------
function loadEpoch(): Pt[] {
  return readFileSync(EPOCH, "utf8").trim().split("\n").map((l) => {
    const r = JSON.parse(l);
    return {
      src: "epoch" as const, id: r.id, url: r.url, ts: r.ts, name: r.name, operator: r.operator, lat: r.lat, lon: r.lon,
      cc: null, countryName: r.country === "United States" ? "United States" : r.country,
      extra: { status: r.status, power_mw: r.power_mw, h100_equivalents: r.h100_equivalents, region: r.region },
    };
  });
}

// ---------- run sources; one failing source must not stop the others ----------
const pts: Pt[] = [];
const rawCounts: Record<string, number> = {};
for (const [label, load] of [["epoch", async () => loadEpoch()], ["wikidata", loadWikidata], ["peeringdb", loadPeeringDb], ["osm", loadOsm]] as const) {
  try {
    const got = await load();
    rawCounts[label] = got.length;
    pts.push(...got);
    console.log(`${label}: ${got.length} usable points`);
  } catch (err) {
    blocked.push(`${label}: ${(err as Error).message}`);
    console.log(`${label} FAILED: ${(err as Error).message}`);
  }
}
if (osmFailed.length) blocked.push(`osm tiles failed after splitting: ${osmFailed.join(" | ")}`);

// ---------- country + region on every point ----------
for (const p of pts) {
  if (p.src === "epoch") continue; // Epoch's own region/country stay as built
  if (!p.countryName) p.countryName = countryFromPoint(p.lat, p.lon);
}

// ---------- dedup: greedy, anchor-based (no chaining) ----------
const rad = Math.PI / 180;
function metres(a: Pt, b: Pt) {
  const dx = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad), dy = (b.lat - a.lat) * rad;
  return 6371000 * Math.hypot(dx, dy);
}
const STOP = new Set("data center centre centers centres datacenter datacentre dc the inc ltd llc co corp gmbh limited campus building facility site colocation colo internet services technologies technology solutions group telecom and of de la le new north south east west".split(" "));
const tokens = (...s: (string | null)[]) => new Set(
  s.filter(Boolean).join(" ").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter((t) => !STOP.has(t) && !/^\d+$/.test(t) && (t.length >= 3 || (t.length >= 2 && /\p{Script=Han}/u.test(t)))),
);
const looseMatch = (a: Pt, b: Pt) => { const ta = tokens(a.name, a.operator), tb = tokens(b.name, b.operator); for (const t of ta) if (tb.has(t)) return true; return false; };

const order: Src[] = ["epoch", "wikidata", "peeringdb", "osm"];
pts.sort((a, b) => order.indexOf(a.src) - order.indexOf(b.src) || (a.id < b.id ? -1 : 1));
interface Cluster { anchor: Pt; members: Pt[] }
const clusters: Cluster[] = [];
const grid = new Map<string, Cluster[]>();
const cell = (p: Pt) => `${Math.floor(p.lat / 0.01)}:${Math.floor(p.lon / 0.01)}`;
for (const p of pts) {
  let target: Cluster | null = null;
  if (p.src !== "epoch") { // two Epoch sites are never merged into one
    let best = Infinity;
    const cy = Math.floor(p.lat / 0.01), cx = Math.floor(p.lon / 0.01);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const c of grid.get(`${cy + dy}:${cx + dx}`) ?? []) {
      const d = metres(p, c.anchor);
      if (d < best && (d <= 100 || (d <= 300 && looseMatch(p, c.anchor)))) { best = d; target = c; }
    }
  }
  if (target) target.members.push(p);
  else {
    const c = { anchor: p, members: [p] };
    clusters.push(c);
    (grid.get(cell(p)) ?? grid.set(cell(p), []).get(cell(p))!).push(c);
  }
}

// ---------- build records ----------
const NAME_PRI: Src[] = ["epoch", "wikidata", "peeringdb", "osm"];
const COORD_PRI: Src[] = ["epoch", "osm", "wikidata", "peeringdb"]; // OSM is a mapped building, the most precise
const pick = <T>(ms: Pt[], pri: Src[], f: (p: Pt) => T | null): T | null => {
  for (const s of pri) for (const m of ms) if (m.src === s) { const v = f(m); if (v != null) return v; }
  return null;
};
const SRC_NAME: Record<Src, string> = { epoch: "epoch-datacentres", wikidata: "wikidata", peeringdb: "peeringdb", osm: "osm" };
const out: Record<string, unknown>[] = [];
let noCoords = 0;
for (const c of clusters) {
  const ms = c.members;
  const epoch = ms.find((m) => m.src === "epoch");
  const coord = pick(ms, COORD_PRI, (m) => ({ lat: m.lat, lon: m.lon }))!;
  const countryName = epoch?.countryName ?? pick(ms, ["wikidata", "peeringdb", "osm"], (m) => m.countryName);
  const cc = pick(ms, ["wikidata", "peeringdb", "osm"], (m) => m.cc);
  const region: Region = epoch ? (epoch.extra!.region as Region) : regionOf(cc, countryName);
  const ids: Record<string, string[]> = {};
  for (const m of ms) (ids[SRC_NAME[m.src]] ??= []).push(m.id);
  const primary = order.find((s) => ms.some((m) => m.src === s))!;
  const pid = ms.find((m) => m.src === primary)!;
  const ts = epoch ? epoch.ts : ms.map((m) => m.ts).sort()[0]; // frontier keeps Epoch's own ts; public = earliest member
  const rec: Record<string, unknown> = {
    ts: new Date(ts).toISOString().replace(".000Z", "Z"),
    source: SRC_NAME[primary], kind: "datacentre",
    id: epoch ? epoch.id : `${primary === "peeringdb" ? "pdb" : primary === "wikidata" ? "wd" : "osm"}:${pid.id}`,
    url: pid.url,
    name: pick(ms, NAME_PRI, (m) => m.name), operator: pick(ms, NAME_PRI, (m) => m.operator),
    lat: +coord.lat.toFixed(5), lon: +coord.lon.toFixed(5),
    country: countryName, region, tier: epoch ? "frontier" : "public",
    sources: order.filter((s) => ms.some((m) => m.src === s)).map((s) => SRC_NAME[s]),
    source_ids: ids,
  };
  if (epoch) Object.assign(rec, { status: epoch.extra!.status, power_mw: epoch.extra!.power_mw, h100_equivalents: epoch.extra!.h100_equivalents });
  out.push(rec);
}
out.sort((a, b) => ((a.ts as string) < (b.ts as string) ? -1 : (a.ts as string) > (b.ts as string) ? 1 : (a.id as string) < (b.id as string) ? -1 : 1));
writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join("\n") + "\n");

// ---------- report ----------
const tally = (rs: Record<string, unknown>[], f: (r: Record<string, unknown>) => string) => rs.reduce<Record<string, number>>((a, r) => ((a[f(r)] = (a[f(r)] ?? 0) + 1), a), {});
const preRegion: Record<string, number> = {};
for (const p of pts) { const r = p.src === "epoch" ? (p.extra!.region as string) : regionOf(p.cc, p.countryName); const k = `${p.src}/${r}`; preRegion[k] = (preRegion[k] ?? 0) + 1; }
console.log(`\n${out.length} sites written to ${OUT} (${(readFileSync(OUT).length / 1e6).toFixed(2)} MB)`);
console.log("raw usable points per source:", rawCounts, "total", pts.length);
console.log("pre-dedup points by source/region:", preRegion);
console.log("after dedup by region:", tally(out, (r) => r.region as string), "by tier:", tally(out, (r) => r.tier as string));
console.log("by source combination:", tally(out, (r) => (r.sources as string[]).join("+")));
console.log("country unresolved (null):", out.filter((r) => !r.country).length, "| polygon-nearest fallback used:", polyFallback);
console.log("ts range:", out[0].ts, "->", out.at(-1)!.ts, "| by year:", tally(out, (r) => (r.ts as string).slice(0, 4)));
console.log("China by source:", tally(out.filter((r) => r.region === "China"), (r) => (r.sources as string[]).join("+")));
if (blocked.length) console.log("BLOCKED:", blocked);
