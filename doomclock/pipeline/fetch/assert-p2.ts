// The P2 data asserts (tasks 103 and 110): exits 0 only when the data is fit to enter the game.
// Run: node doomclock/pipeline/fetch/assert-p2.ts   (plain node, no deps, no network; reads data/ read-only)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { asOf } from "../asof/asof.ts";
import { labWeights } from "../derive/weights.ts";
import { derivePins } from "../state/pin-markets.ts";

const DATA = join(import.meta.dirname, "../../../data");
const jsonl = (f: string) => readFileSync(join(DATA, "clean", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const T0 = "2026-10-24T00:00:00Z"; // world facts must predate the game's day
const FREEZE = JSON.parse(readFileSync(join(DATA, "state.json"), "utf8")).asOf; // the data freeze, 2026-10-24T20:51:00Z
let failed = 0;
const check = (name: string, ok: boolean, info = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${info ? `: ${info}` : ""}`);
  if (!ok) failed++;
};

// ---------- task 103: world-facts.jsonl (and rss.jsonl if present) ----------
const facts = jsonl("world-facts.jsonl");
check("world-facts has 8 rows", facts.length === 8, String(facts.length));
check("every world-fact ts < T0", facts.every((f) => Date.parse(f.ts) < Date.parse(T0)), facts.map((f) => f.ts.slice(0, 10)).join(" "));
check("world-facts sorted by ts", facts.every((f, i) => i === 0 || Date.parse(f.ts) >= Date.parse(facts[i - 1].ts)));
const SOURCE = /^(pm:\d+|kalshi:[A-Z0-9.-]+|manifold:\w+|aiid:\d+|https?:\/\/\S+)$/;
check("every world-fact source is a market id, an AIID id or a URL", facts.every((f) => SOURCE.test(f.source) && f.id && f.text && f.url));
// Provenance: a market source must be a market row in our clean data, created before the fact.
const markets = new Map<string, any>();
for (const s of ["polymarket.jsonl", "kalshi.jsonl", "manifold.jsonl"])
  for (const r of jsonl(s)) if (r.kind === "market") markets.set(r.id, r);
const unbacked = facts.filter((f) => /^(pm|kalshi|manifold):/.test(f.source) && !(markets.has(f.source) && Date.parse(markets.get(f.source).ts) < Date.parse(T0)));
check("every market source is a market in data/clean", unbacked.length === 0, unbacked.map((f) => f.source).join(", "));
if (existsSync(join(DATA, "clean", "rss.jsonl"))) {
  const rss = jsonl("rss.jsonl");
  check("rss.jsonl rows parse and ts < T0", rss.every((r) => r.title && r.link && Date.parse(r.ts) < Date.parse(T0)), `${rss.length} rows`);
} else console.log("skip rss.jsonl not written (optional; cut, see task 103)");

// ---------- task 110 ----------
const aiid = jsonl("aiid.jsonl");
const early = aiid.filter((r) => /^\d{4}-\d\d-\d\d$/.test(r.event_date ?? "") && Date.parse(r.ts) < Date.parse(r.event_date + "T00:00:00Z"));
check("0 AIID records with ts < event_date", early.length === 0, `${early.length} of ${aiid.length}`);
check("AIID ts = max(first report, event date)", aiid.every((r) => r.ts === [r.first_report_ts, r.event_date ? r.event_date + "T00:00:00Z" : ""].sort().at(-1)));

const curve = asOf(FREEZE).capabilityCurve();
const qs = curve?.quarters ?? [];
check("KXAGICO curve is monotone (cummax)", qs.length === 45 && qs.every((q, i) => i === 0 || q.p >= qs[i - 1].p));
const EXPECTED = [0.06, 0.18, 0.28, 0.33, 0.39, 0.58, 0.73]; // 2026Q4 .. 2028Q2, the ladder's prices at T0
const got = ["2026Q4", "2027Q1", "2027Q2", "2027Q3", "2027Q4", "2028Q1", "2028Q2"].map((q) => qs.find((x) => x.q === q)?.p ?? NaN);
check("KXAGICO curve matches the expected values", got.every((p, i) => Math.abs(p - EXPECTED[i]) <= 0.005), got.join(", "));

const file = readFileSync(join(import.meta.dirname, "../markets.json"), "utf8");
check("markets.json drift = 0 against the data/clean pins", JSON.stringify(derivePins(), null, 2) + "\n" === file);

const W: Record<string, number> = { OpenAI: 0.34, "Google DeepMind": 0.17, Alibaba: 0.16, Anthropic: 0.12, Meta: 0.06, DeepSeek: 0.06, xAI: 0.05, Nvidia: 0.03 };
const lw = labWeights(FREEZE);
check("lab weights within 0.01 of the expected", lw.labs.every((l) => Math.abs(l.weight - W[l.lab]) <= 0.01) && lw.labs.length === 8, lw.labs.map((l) => `${l.lab} ${l.weight}`).join(", "));
const saved = existsSync(join(DATA, "lab-weights.json")) && JSON.parse(readFileSync(join(DATA, "lab-weights.json"), "utf8"));
check("data/lab-weights.json is current", !!saved && JSON.stringify(saved.labs) === JSON.stringify(lw.labs));

const dc = jsonl("datacentres.jsonl");
const n = (r: string) => dc.filter((d) => d.region === r).length;
check("datacentre coverage is US 66, China 3, rest 8", n("US") === 66 && n("China") === 3 && n("rest") === 8, `US ${n("US")}, China ${n("China")}, rest ${n("rest")}`);
check("datacentre coverage is labelled in docs/data/datacentres.md", /Coverage label/.test(readFileSync(join(DATA, "../docs/data/datacentres.md"), "utf8")));

console.log(failed ? `${failed} check(s) failed` : "all P2 data checks pass");
process.exit(failed ? 1 : 0);
