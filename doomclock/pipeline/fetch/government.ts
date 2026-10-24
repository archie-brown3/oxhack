// Government AI actions -> data/clean/government.jsonl (see docs/data/government.md).
// US Federal Register (EOs + rules), GOV.UK (DSIT, AISI, No10), EU AI Act milestones (hard-coded).
// Keyless JSON APIs only. Every response is saved raw before parsing; raw that exists is reused.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";
import { writeClean, type Rec } from "./clean-lib.ts";

const UA = { "user-agent": "oxhack-doomclock/0.1 (hackathon project; contact via GitHub)" };
const day = new Date().toISOString().slice(0, 10);
const FROM = "2024-10-24";
const sec = (v: string | number) => new Date(v).toISOString().replace(/\.\d{3}Z$/, "Z");

// Parsed JSON of data/raw/<source>/<name>, fetching and saving it first if missing (200 ms apart).
async function cached(source: string, name: string, url: string): Promise<any> {
  const path = join(RAW, source, name);
  if (!existsSync(path)) {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    await saveRaw(source, name, await res.text());
    await new Promise((r) => setTimeout(r, 200));
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const recs: Rec[] = [];

// (a) US Federal Register: full-text "artificial intelligence" since FROM, then a title filter.
const FR_FIELDS = ["title", "publication_date", "signing_date", "html_url", "subtype",
  "executive_order_number", "document_number", "type", "agencies"];
async function federalRegister(name: string, types: string[]) {
  const q = new URLSearchParams([["per_page", "200"], ["order", "oldest"],
    ["conditions[term]", '"artificial intelligence"'], ["conditions[publication_date][gte]", FROM],
    ...types.map((t) => ["conditions[type][]", t]), ...FR_FIELDS.map((f) => ["fields[]", f])]);
  let url = `https://www.federalregister.gov/api/v1/documents.json?${q}`;
  const docs: any[] = [];
  for (let n = 1; url; n++) {
    const j = await cached("federal-register", `${name}.${day}${n > 1 ? `.p${n}` : ""}.json`, url);
    docs.push(...(j.results ?? []));
    url = j.next_page_url;
  }
  return docs;
}
const PRES_RE = /artificial intelligence|\bAI\b|super ?intelligence|genesis mission|data cent(er|re)/i;
const RULE_RE = /artificial intelligence|\bAI\b|advanced computing/i;
const pres = (await federalRegister("presdocu", ["PRESDOCU"])).filter((d) => PRES_RE.test(d.title));
const rules = (await federalRegister("rules", ["RULE", "PRORULE"])).filter((d) => RULE_RE.test(d.title));
for (const d of [...pres, ...rules]) {
  if (!d.publication_date) continue;
  const issuer = d.agencies?.[0]?.name ?? d.agencies?.[0]?.raw_name ?? "Federal Register";
  const title = d.executive_order_number ? `US Executive Order ${d.executive_order_number}: ${d.title}`
    : d.type === "Presidential Document" ? `US ${d.subtype ?? "presidential document"}: ${d.title}`
    : `${issuer} ${d.type === "Proposed Rule" ? "proposed rule" : "rule"}: ${d.title}`;
  recs.push({
    ts: `${d.publication_date}T00:00:00Z`, source: "federal-register", kind: "government",
    id: `fr:${d.document_number}`, url: d.html_url, title, region: "US", issuer, doc_type: d.subtype ?? d.type,
    ...(d.executive_order_number && { executive_order_number: Number(d.executive_order_number) }),
    ...(d.signing_date && { signing_date: d.signing_date }),
  });
}

// (b) GOV.UK: search (public_timestamp = last update), then the content API for first_published_at.
const s = new URLSearchParams([["count", "500"], ["order", "public_timestamp"], ["q", "AI"],
  ["filter_public_timestamp", `from:${FROM}`],
  ...["press_release", "policy_paper", "news_story", "speech"].map((t) => ["filter_content_store_document_type[]", t]),
  ...["department-for-science-innovation-and-technology", "ai-security-institute",
    "prime-ministers-office-10-downing-street"].map((o) => ["filter_organisations[]", o]),
  ["fields", "title,public_timestamp,link,content_store_document_type,organisations"]]);
const search = await cached("govuk", `search.${day}.json`, `https://www.gov.uk/api/search.json?${s}`);
if (search.total > search.results.length) console.warn(`govuk: ${search.total} hits, only ${search.results.length} read`);
const TOPIC = /\bAI\b|artificial intelligence|frontier|superintelligen|AI Security Institute|AISI/;
const ACTION = /safety|security|\brisks?\b|defen[cs]e|evaluation|regulat|legislat|\bbill\b|\blaw\b|frontier|superintelligen|action plan|strategy|agreement|partnership|summit|declaration|compute|supercomput|growth zone|copyright|sovereign|\bchips?\b|hardware plan|opportunities/i;
for (const r of search.results.filter((r: any) => TOPIC.test(r.title) && ACTION.test(r.title))) {
  let c;
  try {
    c = await cached("govuk", `content/${r.link.replaceAll("/", "_")}.json`, `https://www.gov.uk/api/content${r.link}`);
  } catch (e) { console.warn("govuk: skipped", (e as Error).message); continue; }
  if (!c.first_published_at) continue;
  // first_published_at can be a date the publisher typed (local midnight) rather than the go-live
  // time. A schedule gives the real go-live, so take the later of the two. A bare midnight with no
  // schedule only means "that UK day": use the next local midnight (+24 h; UK clocks change at
  // 01:00 UTC, after local midnight, so both midnights share an offset).
  let t = Date.parse(c.first_published_at);
  if (c.publishing_scheduled_at) {
    t = Math.max(t, Date.parse(c.publishing_scheduled_at) + 1000 * (c.scheduled_publishing_delay_seconds ?? 0));
  } else if (/T00:00:00(\.0+)?(Z|[+-]\d\d:\d\d)$/.test(c.first_published_at)) t += 864e5;
  const ts = sec(t);
  if (ts < `${FROM}T00:00:00Z`) continue;
  recs.push({
    ts, source: "gov.uk", kind: "government", id: `govuk:${r.link}`, url: `https://www.gov.uk${r.link}`,
    title: `UK government: ${r.title}`, region: "rest", issuer: r.organisations?.[0]?.title ?? "UK government",
    doc_type: r.content_store_document_type,
  });
}

// (c) EU AI Act application dates, transcribed from Regulation (EU) 2024/1689 Art. 113.
for (const [date, title] of [
  ["2025-02-02", "EU AI Act: bans on prohibited AI practices and AI-literacy duties apply"],
  ["2025-08-02", "EU AI Act: obligations for general-purpose AI model providers, governance and penalties apply"],
]) {
  recs.push({
    ts: `${date}T00:00:00Z`, source: "eur-lex", kind: "government", id: `eu:ai-act-${date}`,
    url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj", title, region: "rest", issuer: "European Union",
    doc_type: "statutory milestone", citation: "Regulation (EU) 2024/1689, Art. 113",
  });
}

const now = sec(new Date().toISOString());
await writeClean("government", recs.filter((r) => r.ts < now));
