// Wikipedia "YYYY in artificial intelligence": dated, cited headline events → data/clean/wikipedia_ai.jsonl.
// One keyless MediaWiki API call (2024–2026 articles), saved raw once per day, then parsed from the saved copy.
// Run: node doomclock/pipeline/fetch/wikipedia-ai.ts   (plain node, no deps). Rules: docs/data/wikipedia_ai.md.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";
import { CUT, writeClean, type Rec } from "./clean-lib.ts";

const API =
  "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main" +
  "&format=json&formatversion=2&titles=2024_in_artificial_intelligence|2025_in_artificial_intelligence|2026_in_artificial_intelligence";
const UA = { "user-agent": "oxhack-doomclock/0.1 (hackathon project; contact via GitHub)" };

// fetch (resumable: one copy per day); the raw file's mtime is the fetch time
const name = `year-in-ai.${new Date().toISOString().slice(0, 10)}.json`;
const path = join(RAW, "wikipedia", name);
if (!existsSync(path)) {
  const res = await fetch(API, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${API}`);
  await saveRaw("wikipedia", name, await res.text());
}
const fetchedAt = statSync(path).mtime.toISOString();
const raw = JSON.parse(readFileSync(path, "utf8"));
if (raw.error) throw new Error(`API error: ${JSON.stringify(raw.error)}`);
if (raw.continue) console.warn("warning: API response is incomplete (continue)", raw.continue);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = `(${MONTHS.join("|")})`;
const DASH = "(?:–|&ndash;|-)";
// "<day>[–<day>] [<Month>] [– <day> [<Month>]] [– <text>]"; ranges keep the first day
const DATE = new RegExp(`^(\\d{1,2})(?:\\s*${DASH}\\s*\\d{1,2})?(?:\\s+${MON})?(?:\\s*${DASH}\\s*\\d{1,2}(?:\\s+${MON})?)?\\s*(?:${DASH}\\s*([\\s\\S]*))?$`);

const ENT: Record<string, string> = { ndash: "–", mdash: "—", nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", minus: "−", hellip: "…", thinsp: " " };
function strip(s: string) {
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<ref\b[^>]*\/>/gi, "").replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  for (let prev = ""; prev !== s; ) { prev = s; s = s.replace(/\{\{[^{}]*\}\}/g, ""); }
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/'{2,}/g, "").replace(/<[^>]+>/g, "");
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m);
  return s.replace(/\s+/g, " ").trim();
}
const cut = (s: string) => {
  if (s.length <= 240) return s;
  const head = s.slice(0, 240);
  return head.slice(0, head.lastIndexOf(" ")).replace(/[\s,;:–-]+$/, "") + "…";
};

// refs, in order: { name?, body? } (body absent for <ref name=x/>)
const NAME = /name\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/i;
function refs(s: string) {
  const out: { name?: string; body?: string }[] = [];
  const tag = /<ref\b([^>]*?)(\/?)>/gi;
  for (let m; (m = tag.exec(s)); ) {
    const n = m[1].match(NAME), name = n ? (n[1] ?? n[2] ?? n[3]).trim() : undefined;
    if (m[2]) { out.push({ name }); continue; }
    const end = s.indexOf("</ref>", tag.lastIndex);
    if (end < 0) break;
    out.push({ name, body: s.slice(tag.lastIndex, end) });
    tag.lastIndex = end + 6;
  }
  return out;
}
// url= of the first cite template (brace-balanced) that has an http(s) url
function citeUrl(body: string) {
  for (let i = body.search(/\{\{\s*cite\b/i); i >= 0; ) {
    let d = 0, j = i;
    for (; j < body.length - 1; j++) {
      if (body.startsWith("{{", j)) { d++; j++; } else if (body.startsWith("}}", j)) { d--; j++; if (!d) break; }
    }
    const u = body.slice(i, j + 1).match(/\|\s*url\s*=\s*([^|}\s]+)/i)?.[1];
    if (u && /^https?:\/\//.test(u)) return u;
    const next = body.slice(j + 1).search(/\{\{\s*cite\b/i);
    i = next < 0 ? -1 : j + 1 + next;
  }
  return null;
}

// region: item B's AIID text rule (China, then rest of world, then US); unknown → omitted
const word = (alts: string[]) => new RegExp(`(?<![A-Za-z0-9])(${alts.map((a) => a.replace(/\./g, "\\.")).join("|")})(?![A-Za-z0-9])`);
const CHINA = word(["China", "Chinese", "Beijing", "Shanghai", "Shenzhen"]);
const REST = word(("UK, U.K., United Kingdom, British, England, London, Ireland, EU, European, Europe, France, French, Germany, German, " +
  "Italy, Spain, Netherlands, India, Indian, Japan, Japanese, Korea, Korean, Australia, Australian, Canada, Canadian, Brazil, Mexico, " +
  "Russia, Russian, Ukraine, Israel, Iran, Turkey, Indonesia, Philippines, Pakistan, Nigeria, Kenya, South Africa, Singapore, Malaysia, " +
  "Vietnam, Thailand, Argentina, Poland, Sweden, Norway, Denmark, Kosovo, Serbia, Romania, Hungary, Greece, Moldova, Taiwan, Hong Kong, " +
  "Bangladesh, New Zealand, Belgium, Switzerland, Austria, Finland, Portugal, Saudi, UAE, Dubai, Qatar, Egypt").split(", "));
const US = word(["U.S.", "US", "United States", "American", "America", "California", "Texas", "New York", "Florida", "FBI", "FTC", "Congress", "Pentagon", "Trump", "Biden"]);
const regionOf = (t: string) => (CHINA.test(t) ? "China" : REST.test(t) ? "rest" : US.test(t) ? "US" : undefined);

// kind: Executive Order, or a government actor + an official action. ACTOR/ACTION are the brief's lists; the *_EXT
// additions make the 2026 bans, suits and probes by countries, cities and regulators count too (docs/data/wikipedia_ai.md).
const ACTOR = /\b(government|ministry|minister|parliament|congress|senate|president|White House|governor|European Commission|state of)\b|\bEU\b/i;
const ACTION = /\b(signs|signed|passes|passed|enacts|bans|banned|blocks|blocked|orders|fines|fined|becomes? applicable|takes effect|in force)\b|\bpublishes\b.*\b(plan|law|rules)\b/i;
const ACTOR_EXT = new RegExp(`\\b(department|attorney general|council|Ofcom|city of)\\b|^(?:The )?(?:${CHINA.source}|${REST.source}|${US.source})`, "i");
const ACTION_EXT = /\b(lifts|sues|files a lawsuit|filed a lawsuit|investigation|agreement)\b/i;
const kindOf = (t: string) =>
  /\bExecutive Order\b/i.test(t) || ((ACTOR.test(t) || ACTOR_EXT.test(t)) && (ACTION.test(t) || ACTION_EXT.test(t))) ? "government" : "news";

const recs: Rec[] = [];
const drop = { noDay: 0, orphanChild: 0, badDate: 0, before: 0, future: 0, short: 0 };
let wikiUrls = 0;
for (const page of raw.query?.pages ?? []) {
  if (page.missing || !page.revisions?.length) { console.warn("warning: missing page", page.title); continue; }
  const { revid, slots } = page.revisions[0];
  const text: string = slots.main.content, year = Number(page.title.slice(0, 4));
  const defs = new Map<string, string>(); // first <ref name=x>…</ref> in the article
  for (const r of refs(text)) if (r.name && r.body != null && !defs.has(r.name)) defs.set(r.name, r.body);

  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^==\s*Events\s*==\s*$/.test(l));
  if (start < 0) { console.warn("warning: no Events section in", page.title); continue; }
  let month: number | null = null, parent: { day: number; month: number | null } | null = null;
  const items: { day: number; month: number | null; body: string }[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^==[^=]/.test(line)) break; // next level-2 section
    const h = line.match(/^===\s*([^=]+?)\s*===\s*$/);
    if (h) { month = MONTHS.indexOf(h[1]) >= 0 ? MONTHS.indexOf(h[1]) : null; parent = null; continue; }
    const b = line.match(/^(\*+)\s*(.*)$/);
    if (!b) continue;
    const child = b[1].length > 1, d = b[2].replace(/&nbsp;/g, " ").match(DATE);
    // a '**' line takes its date-only parent's date unless it names its own day + month;
    // without a date-only parent it is detail under an item that has text (or under an undated line)
    if (child && !(d && d[2])) { if (parent) items.push({ ...parent, body: b[2] }); else drop.orphanChild++; continue; }
    if (!child) parent = null;
    if (!d) { drop.noDay++; continue; }
    const m = d[2] ? MONTHS.indexOf(d[2]) : month;
    if (d[4] == null || !strip(d[4])) { parent = { day: +d[1], month: m }; continue; } // date-only line
    items.push({ day: +d[1], month: m, body: d[4] });
  }

  const article = page.title, perDay = new Map<string, number>();
  for (const it of items) {
    if (it.month == null) { drop.badDate++; continue; }
    const date = new Date(Date.UTC(year, it.month, it.day));
    if (date.getUTCMonth() !== it.month) { drop.badDate++; continue; }
    const day = date.toISOString().slice(0, 10), ts = `${day}T23:59:59Z`;
    if (Date.parse(ts) < CUT) { drop.before++; continue; }
    if (ts >= fetchedAt) { drop.future++; continue; }
    const full = strip(it.body);
    if (full.length < 20) { drop.short++; console.log("dropped (under 20 chars):", day, JSON.stringify(full)); continue; }
    let url: string | null = null;
    for (const r of refs(it.body)) if ((url = citeUrl(r.body ?? defs.get(r.name ?? "") ?? ""))) break;
    if (!url) { url = `https://en.wikipedia.org/wiki/${year}_in_artificial_intelligence`; wikiUrls++; }
    const k = (perDay.get(day) ?? 0) + 1;
    perDay.set(day, k);
    const region = regionOf(full);
    recs.push({ ts, source: "wikipedia", kind: kindOf(full), id: `wiki:${day}-${k}`, url, title: cut(full), ...(region ? { region } : {}), article, revid });
  }
}

await writeClean("wikipedia_ai", recs);
const tally = (f: (r: Rec) => unknown) => recs.reduce<Record<string, number>>((a, r) => ((a[String(f(r) ?? "unknown")] = (a[String(f(r) ?? "unknown")] ?? 0) + 1), a), {});
console.log("fetched", fetchedAt, "| by article", tally((r) => r.article), "| by region", tally((r) => r.region));
console.log("dropped", drop, "| wikipedia fallback urls", wikiUrls);
