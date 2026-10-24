// data/raw/manifold -> data/clean/manifold.jsonl. Run: `node clean-manifold.ts` (after manifold.ts).
// kinds: market (ts = createdTime), price (daily close from bets, ts = end of that UTC day or the last bet),
// resolution (ts = resolutionTime; backtest_pool = resolved YES/NO binary with price history).
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";
import { CUT, iso, writeClean, type Rec } from "./clean-lib.ts";

const MIN_BETTORS = 20;
const dir = join(RAW, "manifold");
const core = new Set<string>(JSON.parse(await readFile(join(import.meta.dirname, "../markets.json"), "utf8")).manifold.map((m: any) => m.id));
const recs: Rec[] = [];

for (const f of await readdir(join(dir, "markets"))) {
  const m = JSON.parse(await readFile(join(dir, "markets", f), "utf8"));
  if (m.outcomeType !== "BINARY" || ((m.uniqueBettorCount ?? 0) < MIN_BETTORS && !core.has(m.id))) continue;
  const ts = iso(m.createdTime);
  if (!ts) continue;
  const common = { source: "manifold", id: `manifold:${m.id}`, url: m.url, question: m.question };
  recs.push({ ...common, ts, kind: "market", core: core.has(m.id), close_time: iso(m.closeTime), traders: m.uniqueBettorCount, volume: Math.round(m.volume), description: m.textDescription });

  // daily close price from bets (probAfter of the last non-cancelled bet of each UTC day)
  const days = new Map<string, { t: number; p: number }>();
  const bdir = join(dir, "bets", m.id);
  if (existsSync(bdir)) {
    for (const bf of await readdir(bdir)) {
      for (const b of JSON.parse(await readFile(join(bdir, bf), "utf8"))) {
        if (b.isCancelled || typeof b.probAfter !== "number") continue;
        const day = new Date(b.createdTime).toISOString().slice(0, 10);
        const cur = days.get(day);
        if (!cur || b.createdTime > cur.t) days.set(day, { t: b.createdTime, p: b.probAfter });
      }
    }
  }
  const now = Date.now();
  // keep the window plus the last close before it (the as-of starting price)
  const before = [...days.keys()].filter((d) => Date.parse(d + "T23:59:59Z") < CUT).sort();
  for (const d of before.slice(0, -1)) days.delete(d);
  for (const [day, { p }] of days) {
    const end = Date.parse(day + "T23:59:59Z");
    recs.push({ ...common, ts: iso(Math.min(end, now))!, kind: "price", p: Math.round(p * 1e4) / 1e4 });
  }
  const res = m.resolution, rts = iso(m.resolutionTime);
  if (m.isResolved && rts && res) {
    recs.push({ ...common, ts: rts, kind: "resolution", result: res, resolution_probability: m.resolutionProbability ?? null, backtest_pool: (res === "YES" || res === "NO") && days.size > 0 });
  }
}
await writeClean("manifold", recs);
