// Bulk Polymarket download for AI events since 24 Oct 2024. Raw only, resumable: `node polymarket.ts`.
// data/raw/polymarket/{lists/..., events/<id>.json, prices/<tokenId>.json}
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { RAW, getJson, saveRaw } from "../lib/raw.ts";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const CUT = Date.parse("2024-10-24T00:00:00Z");
const TAGS = ["ai", "openai", "artificial-intelligence", "chatgpt", "tech", "big-tech", "anthropic", "nvidia", "elon-musk", "science"];
const TERMS = ["AI", "AGI", "OpenAI", "Anthropic", "best ai model", "ChatGPT", "GPT-5", "Gemini", "Claude", "DeepSeek", "Grok", "superintelligence", "artificial intelligence", "LLM", "Nvidia", "xAI", "Sora", "robot"];
const AI_RE = /\b(AI|A\.I\.|AGI|ASI|OpenAI|Anthropic|DeepMind|LLMs?|GPT-?\d*\w*|ChatGPT|Claude|Gemini|superintelligen\w*|artificial intelligence|Grok|DeepSeek|xAI|Sora|Llama|Mistral|best model|ai model)\b/i;
const DELAY = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) => s.replace(/[^\w-]+/g, "_");

async function cached<T>(name: string, url: string): Promise<T> {
  const path = join(RAW, "polymarket", name);
  if (existsSync(path)) return JSON.parse(await readFile(path, "utf8"));
  const body = await getJson<T>(url);
  await saveRaw("polymarket", name, JSON.stringify(body));
  await sleep(DELAY);
  return body;
}

// 1+2. discover AI events (skipped once events/ is populated). Discovery pages are big and
// overlap heavily, so they are gzipped in lists/ after the first run (`gzip -r lists`).
const dir = join(RAW, "polymarket", "events");
if (!existsSync(dir) || !(await readdir(dir)).length) {
  const events = new Map<string, any>();
  const take = (rows: any[]) => rows.forEach((e) => events.set(String(e.id), e));
  for (const tag of TAGS) {
    for (const closed of ["true", "false"]) {
      for (let off = 0; off < 5000; off += 100) {
        const rows = await cached<any[]>(`lists/tag_${tag}_closed-${closed}_${off}.json`, `${GAMMA}/events?tag_slug=${tag}&closed=${closed}&limit=100&offset=${off}`).catch(() => []);
        take(rows);
        if (rows.length < 100) break;
      }
    }
    console.log("tag", tag, "events", events.size);
  }
  for (const term of TERMS) {
    for (let page = 1; page <= 10; page++) {
      const r = await cached<{ events?: any[]; pagination?: { hasMore?: boolean } }>(`lists/search_${slug(term)}_${page}.json`, `${GAMMA}/public-search?q=${encodeURIComponent(term)}&limit_per_type=50&page=${page}&events_status=all`).catch(() => ({}) as any);
      take(r.events ?? []);
      if (!r.pagination?.hasMore) break;
    }
    console.log("search", term, "events", events.size);
  }
  const wanted = [...events.values()].filter((e) => {
    const end = Date.parse(e.closedTime ?? e.endDate ?? "") || Date.parse(e.endDate ?? "") || 0;
    const start = Date.parse(e.startDate ?? e.creationDate ?? "") || 0;
    return (end >= CUT || start >= CUT) && AI_RE.test(`${e.title} ${e.slug}`);
  });
  console.log("AI events in window:", wanted.length, "of", events.size);
  for (const e of wanted) await saveRaw("polymarket", `events/${e.id}.json`, JSON.stringify(e));
}

// collect the Yes token of every market (No price = 1 - Yes); multi-outcome events are one Yes per market
// Kept: the "which company has the best AI model" events, plus AI events with >= $50k volume
// (minus "what will X say" mention markets); within them only markets with >= $5k volume.
const MONTHLY_RE = /which company has (the )?best ai model/i;
const NOISE_RE = /\b(say|mention|tweet|post)\b/i;
const tokens: { id: string; market: string }[] = [];
for (const f of (await readdir(dir)).filter((n) => n.endsWith(".json"))) {
  const e = JSON.parse(await readFile(join(dir, f), "utf8"));
  if (!(MONTHLY_RE.test(e.title) || (Number(e.volume ?? 0) >= 50_000 && !NOISE_RE.test(e.title)))) continue;
  for (const m of e.markets ?? []) {
    if (Number(m.volume ?? 0) < 5_000) continue;
    try {
      const ids: string[] = JSON.parse(m.clobTokenIds ?? "[]");
      if (ids[0]) tokens.push({ id: ids[0], market: m.id });
    } catch { /* skip malformed */ }
  }
}
console.log("Yes tokens:", tokens.length);

// 3. daily price history per outcome token
let n = 0;
for (const t of tokens) {
  await cached(`prices/${t.id}.json`, `${CLOB}/prices-history?market=${t.id}&interval=max&fidelity=1440`).catch((e) => console.error("price fail", t.id, String(e)));
  if (++n % 100 === 0) console.log("prices", n, "/", tokens.length);
}
console.log("done");
