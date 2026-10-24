// Bulk Kalshi download for AI-related series. Raw only, resumable: `node kalshi.ts`.
// data/raw/kalshi/{series_all.json, series/<T>.json, markets/<T>/..., candles/<ticker>.json}
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RAW, getJson, saveRaw } from "../lib/raw.ts";

const API = "https://api.elections.kalshi.com/trade-api/v2";
const START = Math.floor(Date.parse("2024-10-24T00:00:00Z") / 1000);
const NOW = Math.floor(Date.now() / 1000);
const DELAY = 150;
const MIN_SERIES_VOL = 100_000; // contracts traded across a series; below this the series is noise
const MIN_MARKET_VOL = 1_000;
const MUST = ["KXAGICO", "KXUSTAKEOVER"];
const AI_RE = /\b(AI|AGI|LLMs?|GPT-?\d*|ChatGPT|OpenAI|Anthropic|Gemini|Grok|Claude|DeepSeek|Turing|Sora|Altman|Llama|Mistral|model|robotaxi|humanoid|compute|FLOPs?|chatbot|superintelligen\w*|artificial|Nvidia|Arena)\b/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cached<T>(name: string, url: string): Promise<T> {
  const path = join(RAW, "kalshi", name);
  if (existsSync(path)) return JSON.parse(await readFile(path, "utf8"));
  const body = await getJson<T>(url);
  await saveRaw("kalshi", name, JSON.stringify(body));
  await sleep(DELAY);
  return body;
}

// 1. all series, then keep the AI-looking ones
const all = await cached<{ series: any[] }>("series_all.json", `${API}/series`);
const aiSeries = all.series.filter((s) => MUST.includes(s.ticker) || AI_RE.test(s.title ?? ""));
console.log("series total", all.series.length, "AI-looking", aiSeries.length);

// 2. markets per series: live (/markets) + archived (/historical/markets), cursor-paged
type Mkt = { ticker: string; series?: string };
const markets = new Map<string, { series: string; historical: boolean; m: any }>();
for (const s of aiSeries) {
  for (const hist of [false, true]) {
    let cursor = "";
    for (let p = 0; p < 50; p++) {
      const base = `${API}${hist ? "/historical" : ""}/markets?series_ticker=${s.ticker}&limit=1000${cursor ? `&cursor=${cursor}` : ""}`;
      const page = await cached<{ markets: any[]; cursor?: string }>(`markets/${s.ticker}/${hist ? "hist" : "live"}_${p}.json`, base).catch(() => ({ markets: [], cursor: "" }));
      for (const m of page.markets) if (!markets.has(m.ticker)) markets.set(m.ticker, { series: s.ticker, historical: hist, m });
      if (!page.cursor || !page.markets.length) break;
      cursor = page.cursor;
    }
  }
}
console.log("markets", markets.size);

// keep only series with real volume (+ the must-haves) and markets with some trading
const seriesVol = new Map<string, number>();
for (const { series, m } of markets.values()) seriesVol.set(series, (seriesVol.get(series) ?? 0) + Number(m.volume_fp ?? 0));
for (const [t, e] of markets) {
  if (MUST.includes(e.series)) continue;
  if ((seriesVol.get(e.series) ?? 0) < MIN_SERIES_VOL || Number(e.m.volume_fp ?? 0) < MIN_MARKET_VOL) markets.delete(t);
}
console.log("markets kept for candles", markets.size);

// 3. daily candles over the market's life, clipped to the 2-year window
let n = 0;
for (const [ticker, { series, historical, m }] of markets) {
  const open = m.open_time ? Math.floor(Date.parse(m.open_time) / 1000) : START;
  const close = m.close_time ? Math.floor(Date.parse(m.close_time) / 1000) : NOW;
  const from = Math.max(START, open), to = Math.min(NOW, close + 86400);
  if (to <= from) continue;
  const q = `start_ts=${from}&end_ts=${to}&period_interval=1440`;
  const url = historical
    ? `${API}/historical/markets/${ticker}/candlesticks?${q}`
    : `${API}/series/${series}/markets/${ticker}/candlesticks?${q}`;
  await cached(`candles/${ticker}.json`, url).catch((e) => console.error("candle fail", ticker, String(e)));
  if (++n % 100 === 0) console.log("candles", n, "/", markets.size);
}
console.log("done");
