// data/raw/polymarket -> data/clean/polymarket.jsonl. Run: `node clean-polymarket.ts` (after polymarket.ts).
// kinds: market (ts = market start), price (ts = CLOB point time, Yes price), resolution (ts = market close time).
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";
import { CUT, iso, writeClean, type Rec } from "./clean-lib.ts";

const MONTHLY_RE = /which company has (the )?best ai model/i;
const NOISE_RE = /\b(say|mention|tweet|post)\b/i;
const dir = join(RAW, "polymarket");
const recs: Rec[] = [];

for (const f of (await readdir(join(dir, "events"))).filter((n) => n.endsWith(".json"))) {
  const e = JSON.parse(await readFile(join(dir, "events", f), "utf8"));
  const monthly = MONTHLY_RE.test(e.title);
  if (!(monthly || (Number(e.volume ?? 0) >= 50_000 && !NOISE_RE.test(e.title)))) continue;
  const url = `https://polymarket.com/event/${e.slug}`;
  for (const m of e.markets ?? []) {
    if (Number(m.volume ?? 0) < 5_000) continue;
    const ts = iso(m.startDate) ?? iso(m.createdAt) ?? iso(e.startDate);
    if (!ts) continue; // cannot timestamp: drop
    const common = { source: "polymarket", url, id: `pm:${m.id}`, event_id: e.id, event_title: e.title, question: m.question, outcome: m.groupItemTitle || null };
    recs.push({ ...common, ts, kind: "market", monthly_best_model: monthly, end_date: iso(m.endDate), volume: Number(m.volume), description: m.description });
    const outcomes: string[] = JSON.parse(m.outcomes ?? "[]");
    const prices: number[] = JSON.parse(m.outcomePrices ?? "[]").map(Number);
    const closedTs = iso(m.closedTime) ?? (m.closed ? iso(e.closedTime) ?? iso(m.endDate) : null);
    if (m.closed && closedTs && outcomes[0] === "Yes" && (prices[0] >= 0.99 || prices[0] <= 0.01)) {
      recs.push({ ...common, ts: closedTs, kind: "resolution", result: prices[0] >= 0.99 ? "YES" : "NO" });
    }
    const tok = (JSON.parse(m.clobTokenIds ?? "[]") as string[])[0];
    const pf = tok && join(dir, "prices", `${tok}.json`);
    if (pf && existsSync(pf)) {
      for (const pt of JSON.parse(await readFile(pf, "utf8")).history ?? []) {
        if (pt.t * 1000 < CUT) continue;
        recs.push({ source: "polymarket", url, id: common.id, ts: iso(pt.t * 1000)!, kind: "price", p: pt.p });
      }
    }
  }
}
await writeClean("polymarket", recs);
