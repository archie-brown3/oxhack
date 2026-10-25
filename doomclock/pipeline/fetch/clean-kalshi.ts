// data/raw/kalshi -> data/clean/kalshi.jsonl. Run: `node clean-kalshi.ts` (after kalshi.ts).
// kinds: market (ts = open_time, with rules text), price (ts = end of daily candle), resolution (ts = settlement_ts).
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";
import { CUT, iso, writeClean, type Rec } from "./clean-lib.ts";

const CORE = ["KXAGICO", "KXUSTAKEOVER"];
const dir = join(RAW, "kalshi");
const recs: Rec[] = [];
const seen = new Set<string>();

for (const series of await readdir(join(dir, "markets"))) {
  for (const f of await readdir(join(dir, "markets", series))) {
    for (const m of JSON.parse(await readFile(join(dir, "markets", series, f), "utf8")).markets) {
      if (seen.has(m.ticker)) continue;
      const cf = join(dir, "candles", `${m.ticker}.json`);
      if (!existsSync(cf)) continue; // filtered out by volume in kalshi.ts
      seen.add(m.ticker);
      const ts = iso(m.open_time) ?? iso(m.created_time);
      if (!ts) continue;
      const common = { source: "kalshi", id: `kalshi:${m.ticker}`, url: `https://kalshi.com/markets/${series.toLowerCase()}`, series, event: m.event_ticker };
      recs.push({ ...common, ts, kind: "market", core: CORE.includes(series), title: m.title, subtitle: m.yes_sub_title, close_time: iso(m.close_time), volume: Number(m.volume_fp), rules_primary: m.rules_primary, rules_secondary: m.rules_secondary });
      const result = String(m.result ?? "").toUpperCase();
      const settled = iso(m.settlement_ts);
      if ((result === "YES" || result === "NO") && settled) recs.push({ ...common, ts: settled, kind: "resolution", result });
      for (const c of JSON.parse(await readFile(cf, "utf8")).candlesticks ?? []) {
        if (c.end_period_ts * 1000 < CUT) continue;
        // Live candles suffix fields with _dollars/_fp; historical candles use bare names (also dollars).
        const px = (o: Record<string, string> | undefined, k: string) => o?.[`${k}_dollars`] ?? o?.[k];
        const bid = Number(px(c.yes_bid, "close")), ask = Number(px(c.yes_ask, "close"));
        const p = px(c.price, "close") ?? px(c.price, "previous") ?? (bid >= 0 && ask >= 0 ? (bid + ask) / 2 : null);
        if (p == null) continue;
        recs.push({ ...common, ts: iso(c.end_period_ts * 1000)!, kind: "price", p: Number(p), bid: bid || null, ask: ask || null, volume: Number(c.volume_fp ?? c.volume), open_interest: Number(c.open_interest_fp ?? c.open_interest) });
      }
    }
  }
}
await writeClean("kalshi", recs);
