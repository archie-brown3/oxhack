// The real WorldEvents (contracts.ts) behind the globe pings, the ticker and the MiroFish seed, with the
// enrichment the UI shows: who (the actor), where (ISO 3166-1 alpha-3), detail (one specific sentence) and major
// (worth a newsflash). Pure: asOf(T) passes in the clean rows it already cut to ts < T. See docs/data/events.md.
import type { Region, WorldEvent } from "../../web/src/contracts.ts";

type Rec = Record<string, any>;
export interface EventSources { aiid: Rec[]; government: Rec[]; wikipedia: Rec[]; bulletin: Rec[]; facts: Rec[] }

// ISO UTC to the second; sub-second times round up (never earlier than public). null if unparseable.
const iso = (v: unknown) => {
  const t = typeof v === "number" ? (v < 1e11 ? v * 1000 : v) : Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? new Date(Math.ceil(t / 1000) * 1000).toISOString().replace(".000Z", "Z") : null;
};
const asRegion = (r: unknown): Region | undefined => (r === "US" || r === "China" || r === "rest" ? r : undefined);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "5 Dec 2024" from an ISO date or time. */
export const dmy = (s: string) => { const d = new Date(s.length === 10 ? s + "T00:00:00Z" : s); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

// ---------- where: the region rule of docs/data/events.md, plus the country it matched ----------

// Case-sensitive. (?!\w) ends each term, so "U.S." and "U.K." match before a space (\b would not).
const CN = /\b(China|Chinese|Beijing|Shanghai|Shenzhen)(?!\w)/;
const REST = /\b(British Columbia|UK|U\.K\.|United Kingdom|British|England|London|Ireland|EU|European|Europe|France|French|Germany|German|Italy|Spain|Netherlands|India|Indian|Japan|Japanese|Korea|Korean|Australia|Australian|Canada|Canadian|Brazil|Mexico|Russia|Russian|Ukraine|Israel|Iran|Turkey|Indonesia|Philippines|Pakistan|Nigeria|Kenya|South Africa|Singapore|Malaysia|Vietnam|Thailand|Argentina|Poland|Sweden|Norway|Denmark|Kosovo|Serbia|Romania|Hungary|Greece|Moldova|Taiwan|Hong Kong|Bangladesh|New Zealand|Belgium|Switzerland|Austria|Finland|Portugal|Saudi|UAE|Dubai|Qatar|Egypt)(?!\w)/;
const US = /\b(U\.S\.|US|United States|American|America|California|Texas|New York|Florida|FBI|FTC|Congress|Pentagon|Trump|Biden)(?!\w)/;
// The country each REST term names (Natural Earth ADM0_A3, as the globe uses). EU/Europe name no country.
const ISO3: Record<string, string> = {
  "British Columbia": "CAN", UK: "GBR", "U.K.": "GBR", "United Kingdom": "GBR", British: "GBR", England: "GBR", London: "GBR", Ireland: "IRL",
  France: "FRA", French: "FRA", Germany: "DEU", German: "DEU", Italy: "ITA", Spain: "ESP", Netherlands: "NLD",
  India: "IND", Indian: "IND", Japan: "JPN", Japanese: "JPN", Korea: "KOR", Korean: "KOR", Australia: "AUS",
  Australian: "AUS", Canada: "CAN", Canadian: "CAN", Brazil: "BRA", Mexico: "MEX", Russia: "RUS", Russian: "RUS",
  Ukraine: "UKR", Israel: "ISR", Iran: "IRN", Turkey: "TUR", Indonesia: "IDN", Philippines: "PHL", Pakistan: "PAK",
  Nigeria: "NGA", Kenya: "KEN", "South Africa": "ZAF", Singapore: "SGP", Malaysia: "MYS", Vietnam: "VNM",
  Thailand: "THA", Argentina: "ARG", Poland: "POL", Sweden: "SWE", Norway: "NOR", Denmark: "DNK", Kosovo: "KOS",
  Serbia: "SRB", Romania: "ROU", Hungary: "HUN", Greece: "GRC", Moldova: "MDA", Taiwan: "TWN", "Hong Kong": "HKG",
  Bangladesh: "BGD", "New Zealand": "NZL", Belgium: "BEL", Switzerland: "CHE", Austria: "AUT", Finland: "FIN",
  Portugal: "PRT", Saudi: "SAU", UAE: "ARE", Dubai: "ARE", Qatar: "QAT", Egypt: "EGY",
};
const ENTITY: Record<string, Region> = Object.fromEntries([
  ...["openai", "google", "anthropic", "meta", "xai", "microsoft", "amazon", "apple", "waymo", "tesla", "character.ai", "perplexity-ai", "nvidia"].map((e) => [e, "US"]),
  ...["deepseek", "alibaba", "baidu", "bytedance", "tencent", "zhipu-ai", "moonshot-ai", "huawei"].map((e) => [e, "China"]),
]);

/** Region and country from free text: title first, then description; China, then elsewhere, then the US. */
function place(texts: string[]): { region?: Region; where?: string } {
  for (const t of texts) {
    if (CN.test(t)) return { region: "China", where: "CHN" };
    const m = t.match(REST);
    if (m) return { region: "rest", where: ISO3[m[1]] };
    if (US.test(t)) return { region: "US", where: "USA" };
  }
  return {};
}

// ---------- who ----------

const NAMES: Record<string, string> = {
  openai: "OpenAI", google: "Google", anthropic: "Anthropic", meta: "Meta", xai: "xAI", microsoft: "Microsoft",
  amazon: "Amazon", apple: "Apple", waymo: "Waymo", tesla: "Tesla", "character.ai": "Character.AI",
  "perplexity-ai": "Perplexity", nvidia: "Nvidia", deepseek: "DeepSeek", alibaba: "Alibaba", baidu: "Baidu",
  bytedance: "ByteDance", tencent: "Tencent", "zhipu-ai": "Zhipu AI", "moonshot-ai": "Moonshot AI", huawei: "Huawei",
};
const pretty = (slug: string) => NAMES[slug] ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const named = (slugs: unknown) => (Array.isArray(slugs) ? slugs : []).find((s: string) => !/^unknown/.test(s));
// The actor a Wikipedia line names first. A short list on purpose: the labs and offices that appear in the feed.
const ACTORS = /\b(OpenAI|Anthropic|Google DeepMind|Google|Meta|xAI|Microsoft|Nvidia|DeepSeek|Alibaba|Apple|Amazon|Character\.ai|Mistral|Ofcom|European Commission|White House|Trump|Gavin Newsom|Florida Attorney General|Baltimore)\b/;
const WHO: Record<string, string> = { Trump: "US President", "Gavin Newsom": "Governor of California", Baltimore: "City of Baltimore" };

// ---------- detail ----------

/** The first sentence of an AIID description (they are cut at 400 chars, so a cut sentence ends with "…"). */
// A full stop after an initial ("T.", "U.S.") or a title ("Dr.") doesn't end a sentence.
const NOT_END = /(?:^|[\s.(])(?:[A-Z]|Mr|Mrs|Ms|Dr|St|Jr|Sr|Inc|Co|Ltd|Corp|vs|No|Gov|Sen|Rep|Gen|Lt|Col|Sgt|Prof|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.$/;
function firstSentence(s: string): string {
  const text = s.replace(/\s+/g, " ").trim();
  for (const m of text.matchAll(/[.!?](?=\s+[A-Z"“(]|$)/g)) {
    const end = m.index! + 1;
    if (end >= 20 && !NOT_END.test(text.slice(0, end))) return text.slice(0, end);
  }
  return text.length < 400 ? text : text.slice(0, text.lastIndexOf(" ", 380)) + "…";
}
const subject = (title: string) => title.replace(/^[^:]{0,60}:\s*/, "");
const DOC: Record<string, string> = { press_release: "a press release", policy_paper: "a policy paper", speech: "a speech" };

function governmentDetail(r: Rec, ts: string): { who: string; detail: string } {
  const what = subject(r.title ?? "");
  if (r.doc_type === "Executive Order")
    return {
      who: "US President",
      detail: `The US President signed Executive Order ${r.executive_order_number}, "${what}", on ${dmy(r.signing_date ?? ts)}; the Federal Register published it on ${dmy(ts)}.`,
    };
  if (r.source === "federal-register")
    return {
      who: `US ${r.issuer}`,
      detail: `The US ${r.issuer} published a ${r.doc_type === "Proposed Rule" ? "proposed rule" : "final rule"} in the Federal Register on ${dmy(ts)} (document ${String(r.id).replace(/^fr:/, "")}): ${what}.`,
    };
  if (r.source === "eur-lex") return { who: r.issuer, detail: `From ${dmy(ts)}, under the EU AI Act (${r.citation ?? "Regulation (EU) 2024/1689"}): ${what}.` };
  if (r.source === "gov.uk") return { who: `UK ${r.issuer}`, detail: `The UK ${r.issuer} published ${DOC[r.doc_type] ?? "a notice"} on ${dmy(ts)}: ${what}.` };
  return { who: r.issuer, detail: `${r.issuer}, ${dmy(ts)}: ${what}.` };
}

// ---------- build ----------

/** AIID has no severity field: an incident covered by 10 or more press reports counts as major (a heuristic). */
export const AIID_MAJOR_REPORTS = 10;
const MAJOR_DOC = new Set(["Executive Order", "Rule", "statutory milestone"]);

/** Events with start <= ts < T, sorted by ts, then source, then title. Rows must already be cut to ts < T. */
export function buildEvents(src: EventSources, start: string, T: string) {
  const events: WorldEvent[] = [];
  let dropped = 0;
  const tStart = Date.parse(start), tT = Date.parse(T);
  const inWindow = (t: string | null): t is string => !!t && Date.parse(t) >= tStart && Date.parse(t) < tT;
  const add = (e: Omit<WorldEvent, "ts" | "provenance">, ts: unknown): WorldEvent | undefined => {
    const t = iso(ts);
    if (!t || !e.title) { dropped++; return; }
    if (!inWindow(t)) return;
    const ev = { ts: t, provenance: "real", ...e } as WorldEvent;
    for (const k of Object.keys(ev) as (keyof WorldEvent)[]) if (ev[k] === undefined || ev[k] === "") delete ev[k];
    events.push(ev);
    return ev;
  };

  for (const r of src.aiid) {
    const p = place([r.title ?? "", r.description ?? ""]);
    const ent = [...(r.deployers ?? []), ...(r.developers ?? [])].find((e: string) => ENTITY[e]);
    const who = named(r.deployers) ?? named(r.developers);
    const reports = Number(r.n_reports) || 0;
    add({
      kind: "incident", source: "aiid", title: r.title, url: `https://incidentdatabase.ai/cite/${r.id}`,
      region: p.region ?? (ent ? ENTITY[ent] : undefined), where: p.where, who: who && pretty(who),
      detail: r.description ? firstSentence(r.description) + (reports > 1 ? ` Covered in ${reports} press reports.` : "") : undefined,
      major: reports >= AIID_MAJOR_REPORTS || undefined,
    }, r.ts);
  }

  // Only government records kept in the window can absorb a Wikipedia duplicate, so a build at T never reads later records.
  const byEo = new Map<string, WorldEvent>(), byEurLexDay = new Map<string, WorldEvent>();
  for (const r of src.government) {
    const ts = iso(r.ts);
    const g = ts ? governmentDetail(r, ts) : undefined;
    const where = r.source === "federal-register" ? "USA" : r.source === "gov.uk" ? "GBR" : undefined;
    const ev = add({
      kind: "government", source: r.source, title: r.title, url: r.url, region: asRegion(r.region), where,
      who: g?.who, detail: g?.detail, major: MAJOR_DOC.has(r.doc_type) || undefined,
    }, r.ts);
    if (ev && r.executive_order_number != null) byEo.set(String(r.executive_order_number), ev);
    if (ev && r.source === "eur-lex") byEurLexDay.set(ev.ts.slice(0, 10), ev);
  }

  // A Wikipedia duplicate of a government record is dropped (the primary source wins), and the kept event takes
  // the earlier of the two dates: Wikipedia dates an EO's signing, the Federal Register its later publication.
  // A Wikipedia line that cites the same article as a checked world fact is the same event: the fact wins.
  let deduped = 0;
  const factUrls = new Set(src.facts.map((r) => r.url).filter(Boolean));
  for (const r of src.wikipedia) {
    if (factUrls.has(r.url)) { deduped++; continue; }
    const t = iso(r.ts);
    const eo = String(r.title ?? "").match(/\bExecutive Order (\d{5})\b/)?.[1];
    const aiAct = /\b(AI|Artificial Intelligence) Act\b/.test(`${r.title ?? ""} ${r.description ?? ""}`);
    const dup = inWindow(t) ? (eo && byEo.get(eo)) || (aiAct && byEurLexDay.get(t.slice(0, 10))) : undefined;
    if (dup) { if (Date.parse(t!) < Date.parse(dup.ts)) dup.ts = t!; deduped++; continue; }
    const gov = r.kind === "government";
    const actor = String(r.title ?? "").match(ACTORS)?.[1];
    const p = place([r.title ?? ""]);
    add({
      kind: gov ? "government" : "news", source: "wikipedia", title: r.title, url: r.url,
      region: asRegion(r.region) ?? p.region, where: p.where, who: actor && (WHO[actor] ?? actor),
      // Government actions (laws, bans, suits) are turning points; a ban being lifted is not.
      major: (gov && !/\blifts?\b/i.test(r.title ?? "")) || undefined,
    }, r.ts);
  }

  for (const r of src.bulletin)
    add({ kind: "news", source: "bulletin", title: `Bulletin of the Atomic Scientists sets the Doomsday Clock to ${r.seconds_to_midnight} seconds to midnight`, url: r.url, who: "Bulletin of the Atomic Scientists" }, r.ts);

  // world-facts.jsonl: the hand-checked turning points of the starting state (task 103), each a major event.
  for (const r of src.facts) {
    const p = place([r.text ?? ""]);
    add({ kind: r.kind === "government" ? "government" : "news", source: "world-facts", title: r.text, url: r.url, region: asRegion(r.region) ?? p.region, where: r.where ?? p.where, who: r.who, detail: r.detail, major: true }, r.ts);
  }

  events.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts) || a.source.localeCompare(b.source) || a.title.localeCompare(b.title));
  return { events, dropped, deduped };
}
