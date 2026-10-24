// Bulk Manifold download (24 Oct 2024 -> now). Raw only, resumable: `node manifold.ts`.
// data/raw/manifold/{search,markets,bets}/...  Parsing happens elsewhere.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RAW, getJson, saveRaw } from "../lib/raw.ts";

const API = "https://api.manifold.markets/v0";
const CUT = Date.parse("2024-10-24T00:00:00Z");
const TERMS = ["AI", "AGI", "ASI", "OpenAI", "Anthropic", "DeepMind", "LLM", "GPT", "Claude", "Gemini",
  "superintelligence", "alignment", "x-risk", "artificial intelligence", "existential risk", "Grok", "DeepSeek"];
const AI_RE = /\b(AI|A\.I\.|AGI|ASI|OpenAI|Anthropic|DeepMind|LLMs?|GPT-?\d*\w*|ChatGPT|Claude|Gemini|superintelligen\w*|alignment|x-risk|artificial intelligence|machine learning|Grok|DeepSeek|xAI|Sora|Llama|Mistral|neural|existential)\b/i;
const MIN_BETTORS = 20; // only markets with at least this many unique traders are kept (signal filter)
const DELAY = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) => s.replace(/[^\w-]+/g, "_");

// Fetch + save raw unless already on disk; returns parsed body either way.
async function cached<T>(name: string, url: string): Promise<T> {
  const path = join(RAW, "manifold", name);
  if (existsSync(path)) return JSON.parse(await readFile(path, "utf8"));
  const body = await getJson<T>(url);
  await saveRaw("manifold", name, JSON.stringify(body));
  await sleep(DELAY);
  return body;
}

type Stub = { id: string; question: string; outcomeType: string; createdTime: number; resolutionTime?: number; uniqueBettorCount?: number };

// 1a. search: every term x {newest, resolve-date}, paged by offset until empty.
const found = new Map<string, Stub>();
for (const term of TERMS) {
  for (const [sort, filter] of [["newest", "all"], ["resolve-date", "resolved"], ["score", "all"], ["liquidity", "all"], ["last-updated", "all"]]) {
    for (let off = 0, page = 0; page < 20; off += 1000, page++) {
      const url = `${API}/search-markets?term=${encodeURIComponent(term)}&sort=${sort}&filter=${filter}&limit=1000&offset=${off}`;
      // the API rejects deep offsets with 400; treat that as the end of this query
      const rows = await cached<Stub[]>(`search/${slug(term)}__${sort}__${off}.json`, url).catch(() => []);
      if (!rows.length) break;
      for (const m of rows) found.set(m.id, m);
      // sorted descending: once a whole page is older than the cutoff, stop paging
      const key = sort === "newest" ? "createdTime" : sort === "resolve-date" ? "resolutionTime" : null;
      if (key && rows.every((m) => (m[key] ?? 0) < CUT)) break;
    }
  }
  console.log(term, "-> unique so far", found.size);
}

const wanted = [...found.values()].filter(
  (m) => (m.createdTime >= CUT || (m.resolutionTime ?? 0) >= CUT) && (m.uniqueBettorCount ?? 0) >= MIN_BETTORS && AI_RE.test(m.question),
);
console.log("AI-related since cutoff:", wanted.length, "of", found.size);

// pinned core markets are kept even when they were created before the window
const pins: string[] = JSON.parse(await readFile(join(import.meta.dirname, "../markets.json"), "utf8").catch(() => "{}"))?.manifold?.map?.((x: any) => x.id) ?? [];
for (const id of pins) if (!wanted.some((m) => m.id === id)) wanted.push({ id } as Stub);

// 1a. full market objects (description, resolution, resolutionTime).
let n = 0;
const full: Record<string, any> = {};
for (const m of wanted) {
  try {
    full[m.id] = await cached(`markets/${m.id}.json`, `${API}/market/${m.id}`);
  } catch (e) { console.error("market fail", m.id, String(e)); }
  if (++n % 200 === 0) console.log("markets", n, "/", wanted.length);
}

// 1b. bet history for binary markets with enough activity (+ pinned core markets), paged with before=.
const pinned = new Set<string>(JSON.parse(await readFile(join(import.meta.dirname, "../markets.json"), "utf8").catch(() => "{}"))?.manifold?.map?.((x: any) => x.id) ?? []);
const betTargets = Object.values(full).filter(
  (m) => m.outcomeType === "BINARY" && ((m.uniqueBettorCount ?? 0) >= MIN_BETTORS || pinned.has(m.id)),
);
console.log("bet history targets:", betTargets.length);
n = 0;
for (const m of betTargets) {
  let before = "";
  for (let p = 0; p < 200; p++) {
    const file = `bets/${m.id}/${String(p).padStart(3, "0")}.json`;
    const url = `${API}/bets?contractId=${m.id}&limit=1000${before ? `&before=${before}` : ""}`;
    try {
      const bets = await cached<{ id: string }[]>(file, url);
      if (bets.length < 1000) break;
      before = bets[bets.length - 1].id;
    } catch (e) { console.error("bets fail", m.id, String(e)); break; }
  }
  if (++n % 50 === 0) console.log("bets", n, "/", betTargets.length);
}
console.log("done");
