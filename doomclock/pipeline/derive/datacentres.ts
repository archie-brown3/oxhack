// Datacentres for the globe: Epoch AI "AI data centers" (CC BY 4.0) + OSM Nominatim geocoding of Epoch's own addresses.
// Epoch publishes no lat/lon, so every coordinate comes from a geocoder response saved under data/raw/datacentres/.
// Run: node doomclock/pipeline/derive/datacentres.ts   (plain node, no deps; needs the system `unzip`)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";

const day = new Date().toISOString().slice(0, 10);
const ZIP_URL = "https://epoch.ai/data/data_centers/data_centers.zip";
const PAGE = "https://epoch.ai/data/ai-data-centers";
const UA = "oxhack-doomclock/0.1 (hackathon; archie1203brown@gmail.com)";
const OUT = join(RAW, "../clean/datacentres.jsonl");
const dir = join(RAW, "datacentres");

type Row = Record<string, string>;

function parseCsv(t: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows[0];
  return rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1. raw zip, one copy per day
const zip = join(dir, `data_centers.${day}.zip`);
if (!existsSync(zip)) {
  const res = await fetch(ZIP_URL, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${ZIP_URL}`);
  console.log("saved", await saveRaw("datacentres", `data_centers.${day}.zip`, new Uint8Array(await res.arrayBuffer())));
}
const unzip = (name: string) => execFileSync("unzip", ["-p", zip, name], { encoding: "utf8", maxBuffer: 1 << 26 });
const sites = parseCsv(unzip("data_centers.csv"));
const timeline = parseCsv(unzip("data_center_timelines.csv"));

// 2. geocode cache: query -> Nominatim response (saved before parsing; reused across runs)
const cachePath = join(dir, "nominatim.json");
const cache: Record<string, unknown[]> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
async function geocode(q: string): Promise<{ lat: number; lon: number; display: string } | null> {
  if (!(q in cache)) {
    await sleep(1100); // Nominatim usage policy: max 1 request/s
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`${res.status} nominatim ${q}`);
    cache[q] = (await res.json()) as unknown[];
    writeFileSync(cachePath, JSON.stringify(cache, null, 1));
  }
  const hit = cache[q][0] as { lat: string; lon: string; display_name: string } | undefined;
  return hit ? { lat: +hit.lat, lon: +hit.lon, display: hit.display_name } : null;
}

// 3. build records
const today = new Date().toISOString().slice(0, 10);
const byName = new Map<string, Row[]>();
for (const r of timeline) (byName.get(r["Data center"]) ?? byName.set(r["Data center"], []).get(r["Data center"])!).push(r);

const dropped: string[] = [];
const out: Record<string, unknown>[] = [];
for (const s of sites) {
  const name = s.Name;
  const past = (byName.get(name) ?? []).filter((r) => r.Date <= today).sort((a, b) => (a.Date < b.Date ? -1 : 1));
  if (!s.Address) { dropped.push(`${name}: no address`); continue; }
  if (!past.length) { dropped.push(`${name}: no dated timeline row <= today`); continue; }
  // full address first; if OSM can't place it, fall back to the address minus its street part (locality precision)
  const parts = s.Address.split(",").map((p) => p.trim());
  let precision = "address";
  let g = await geocode(s.Address);
  if (!g && parts.length > 2) { precision = "locality"; g = await geocode(parts.slice(1).join(", ")); }
  if (!g) { dropped.push(`${name}: geocoder found nothing for "${s.Address}"`); continue; }
  const last = past.at(-1)!;
  const power = +last["Power (MW)"];
  out.push({
    ts: `${past[0].Date}T00:00:00Z`, // first dated Epoch observation of the site (upper bound on when it became public)
    source: "epoch-datacentres",
    kind: "datacentre",
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    url: PAGE,
    name,
    operator: s.Owner.replace(/\s*#\w+/g, "").trim() || null,
    lat: +g.lat.toFixed(5),
    lon: +g.lon.toFixed(5),
    country: s.Country,
    region: s.Country === "United States" ? "US" : s.Country === "China" ? "China" : "rest",
    status: power > 0 ? "operating" : "planned", // power at the latest timeline row dated <= today
    power_mw: +s["Current power (MW)"] || null,
    h100_equivalents: Math.round(+s["Current H100 equivalents"]) || null,
    address: s.Address,
    geo_precision: precision,
    geo_source: "OpenStreetMap Nominatim",
    geo_match: g.display,
    source_urls: [...s["Selected Sources"].matchAll(/\]\((https?:[^)\s]+)\)/g)].map((m) => m[1]),
  });
}
out.sort((a, b) => ((a.ts as string) < (b.ts as string) ? -1 : (a.ts as string) > (b.ts as string) ? 1 : 0));
writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join("\n") + "\n");

const n = (f: (r: Record<string, unknown>) => string) => out.reduce<Record<string, number>>((a, r) => ((a[f(r)] = (a[f(r)] ?? 0) + 1), a), {});
console.log(`${out.length}/${sites.length} sites written to ${OUT}`);
console.log("region", n((r) => r.region as string), "status", n((r) => r.status as string), "precision", n((r) => r.geo_precision as string));
console.log("dropped:\n" + dropped.join("\n"));
