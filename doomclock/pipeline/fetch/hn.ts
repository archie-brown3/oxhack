// Hacker News (Algolia): ALL matching stories (no points filter, so no future popularity leaks in), one file
// per query per window on created_at_i; points/num_comments are kept as fetched. The backtest filters later
// using only stories at least 48 h old at T. Algolia returns at most 1000 hits per query, so a window with
// more is split in half until it fits (leaf files are named <from>_<to>.json, epoch seconds). Resumable.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RAW, getJson, saveRaw } from "../lib/raw.ts";

const QUERIES = ["AI", "LLM", "AGI", "OpenAI", "Anthropic", "DeepMind", "GPT", "Claude", "Gemini", "superintelligence", "alignment"];
const START = Date.UTC(2024, 9, 24) / 1000;
const WEEK = 7 * 86400;
const now = Math.floor(Date.now() / 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const has = (n: string) => existsSync(join(RAW, "hn", n));
type Page = { nbHits: number; hits: unknown[] };

const url = (q: string, from: number, to: number) =>
  `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=1000` +
  `&numericFilters=${encodeURIComponent(`created_at_i>=${from},created_at_i<${to}`)}`;

async function window(q: string, from: number, to: number) {
  const name = `${q}/${from}_${to}.json`;
  if (has(name)) return;
  if (has(name + ".split")) {
    const mid = Math.floor((from + to) / 2);
    await window(q, from, mid);
    return window(q, mid, to);
  }
  const r = await getJson<Page>(url(q, from, to));
  await sleep(150);
  if (r.nbHits > 1000 && to - from > 3600) {
    await saveRaw("hn", name + ".split", "");
    return window(q, from, to);
  }
  await saveRaw("hn", name, JSON.stringify({ query: q, from, to, ...r }));
}

for (let from = START; from < now; from += WEEK) {
  for (const q of QUERIES) await window(q, from, Math.min(from + WEEK, now));
  console.log("hn week", new Date(from * 1000).toISOString().slice(0, 10));
}
