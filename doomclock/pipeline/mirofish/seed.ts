// Builds the MiroFish round-1 seed in data/seed/round-1/ from data/clean/<source>.jsonl as of a date T.
// Usage: node doomclock/pipeline/mirofish/seed.ts [T as ISO date/time, default now]
// Only records with ts < T are read (ts = when the record became public). No dependencies.
//
// Contract assumed for data/clean (the data agents own the real one; the field lists below are the
// names this script tries, in order, so a rename is a one-line change):
//   every line is a JSON object with `ts` (ISO string, or epoch seconds/ms).
//   hn:      title, points, num_comments, url
//   markets: (manifold|kalshi|polymarket) a market id, a question/title, and a probability in [0,1]
//            (or a price in [0,1], or a percent). Several snapshots per market are fine: the latest ts < T wins.
import { createReadStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

const CLEAN = process.env.CLEAN_DIR ?? join(import.meta.dirname, "../../../data/clean");
const OUT = process.env.SEED_OUT ?? join(import.meta.dirname, "../../../data/seed/round-1");

const T = process.argv[2] ? new Date(process.argv[2]) : new Date();
if (Number.isNaN(T.getTime())) throw new Error(`bad date: ${process.argv[2]}`);
const DAY = 86400_000;
const HN_WINDOW = [T.getTime() - 9 * DAY, T.getTime() - 2 * DAY]; // 7 days of stories, all >= 48 h old at T
const HN_MAX = 40;

type Rec = Record<string, unknown>;
const pick = (r: Rec, keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== null && v !== "");
const num = (v: unknown) => (v === undefined ? NaN : Number(v));

function tsMs(r: Rec): number {
  const v = r.ts;
  if (typeof v === "number") return v < 1e11 ? v * 1000 : v;
  return Date.parse(String(v));
}

// Streams data/clean/<source>.jsonl, keeping records with ts < T. Returns null if the file is missing.
async function load(source: string): Promise<Rec[] | null> {
  const path = join(CLEAN, `${source}.jsonl`);
  if (!existsSync(path)) return null;
  const out: Rec[] = [];
  for await (const line of createInterface({ input: createReadStream(path) })) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as Rec;
    if (tsMs(r) < T.getTime()) out.push(r);
  }
  return out;
}

// --- news digest ---
function digest(hn: Rec[]) {
  const stories = hn
    .filter((r) => tsMs(r) >= HN_WINDOW[0] && tsMs(r) < HN_WINDOW[1])
    .map((r) => ({
      ts: tsMs(r),
      title: String(pick(r, ["title", "story_title"]) ?? "").trim(),
      points: num(pick(r, ["points"])) || 0,
      comments: num(pick(r, ["num_comments", "comments"])) || 0,
    }))
    .filter((s) => s.title);
  const seen = new Set<string>();
  const top = stories
    .sort((a, b) => b.points - a.points)
    .filter((s) => !seen.has(s.title.toLowerCase()) && seen.add(s.title.toLowerCase()))
    .slice(0, HN_MAX);
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const lines = top.map((s) => `- ${day(s.ts)}: ${s.title} (${s.points} points, ${s.comments} comments)`);
  const md =
    `# AI news digest, week to ${day(HN_WINDOW[1])}\n\n` +
    `The ${top.length} most-discussed AI stories on Hacker News from ${day(HN_WINDOW[0])} to ${day(HN_WINDOW[1])}, ` +
    `ranked by points. Only stories at least 48 hours old at ${day(T.getTime())} are included.\n\n` +
    lines.join("\n") + "\n";
  return { md, count: top.length, considered: stories.length };
}

// --- market odds ---
type Market = { source: string; id: string; question: string; p: number; ts: number };

function latestMarkets(source: string, recs: Rec[]): Market[] {
  const latest = new Map<string, Market>();
  for (const r of recs) {
    const id = String(pick(r, ["id", "ticker", "market_id", "slug"]) ?? "");
    const question = String(pick(r, ["question", "title", "yes_sub_title"]) ?? "");
    let p = num(pick(r, ["p", "prob", "probability", "price", "last_price"]));
    if (p > 1 && p <= 100) p /= 100;
    if (!id || !question || !(p >= 0 && p <= 1)) continue;
    const m = { source, id, question, p, ts: tsMs(r) };
    const old = latest.get(id);
    if (!old || m.ts > old.ts) latest.set(id, m);
  }
  return [...latest.values()];
}

// The "core" markets from the brief. Match on question text, since ids aren't pinned yet (markets.json).
const CORE: { label: string; source: string; test: RegExp }[] = [
  { label: "AGI announced by any company (Kalshi curve)", source: "kalshi", test: /agi|artificial general/i },
  { label: "Superintelligence (ASI) arrives (Manifold curve)", source: "manifold", test: /\b(ASI|superintelligen)/i },
  { label: "AI kills at least 10% of humans", source: "manifold", test: /(kill|death|die).*(10%|ten percent)|10%.*(human|humanity)/i },
  { label: "AI catastrophe, loss of control, proliferation", source: "manifold", test: /catastroph|loss[- ]of[- ]control|proliferation|rogue ai/i },
  { label: "Best AI model race (Polymarket)", source: "polymarket", test: /best ai model|top ai model/i },
];
const CORE_MAX_PER_GROUP = 8;

function odds(markets: Market[]) {
  const sections: string[] = [];
  let count = 0;
  for (const g of CORE) {
    const rows = markets
      .filter((m) => m.source === g.source && g.test.test(m.question))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, CORE_MAX_PER_GROUP);
    if (!rows.length) continue;
    count += rows.length;
    sections.push(`## ${g.label}\n\n` + rows.map((m) => `- ${m.question}: ${(m.p * 100).toFixed(0)}% (${m.source}, as of ${new Date(m.ts).toISOString().slice(0, 10)})`).join("\n"));
  }
  const md = `# Prediction-market odds on ${T.toISOString().slice(0, 10)}\n\nReal-money and play-money market prices, the latest known before ${T.toISOString().slice(0, 10)}.\n\n` + sections.join("\n\n") + "\n";
  return { md, count };
}

// --- scenario brief and requirement ---
const BRIEF = (day: string) => `# Scenario brief: the world on ${day}

This is round 1 of the Doom Clock game. No player has moved yet. The world is the real world as of ${day}:
the AI news digest and the market odds in the other two documents are the facts.

Two sides play. The Guardian (a coalition of regulators, safety researchers, labs acting in good faith and the
public) tries to buy time before an AI catastrophe. The Rogue AI (a frontier system with hidden goals, plus the
labs racing to scale it) tries to gain capability and compute while avoiding detection.

Who reacts in this world: frontier labs, regulators and governments, AI safety researchers, journalists, the
public, investors and open-source developers. Use the organisations and people named in the news digest.

Move effects are game rules, not forecasts. Only the market odds and the news are real.
`;

const REQUIREMENT =
  "Simulate how public opinion, media coverage and institutions react over the next three weeks as frontier AI " +
  "labs race to scale capabilities while regulators, safety researchers and the public push for oversight. " +
  "Use the AI news digest and the prediction-market odds as the starting facts. Predict which headlines would " +
  "appear, whether alarm about AI risk rises or falls, and which actors escalate or de-escalate.";

// --- run ---
const day = T.toISOString().slice(0, 10);
const sources = ["hn", "manifold", "kalshi", "polymarket"];
const data: Record<string, Rec[] | null> = {};
for (const s of sources) data[s] = await load(s);
const missing = sources.filter((s) => data[s] === null);

const news = digest(data.hn ?? []);
const markets = ["manifold", "kalshi", "polymarket"].flatMap((s) => latestMarkets(s, data[s] ?? []));
const book = odds(markets);

console.log(`T=${T.toISOString()}  missing sources: ${missing.join(", ") || "none"}`);
console.log(`hn stories in window: ${news.considered} (digest ${news.count}); core market rows: ${book.count}`);

if (!news.count || !book.count) {
  console.error("Not writing a seed: need both HN stories and core market odds. Missing data/clean files: " + (missing.join(", ") || "(present but no matching records)"));
  process.exit(2);
}

await mkdir(OUT, { recursive: true });
const files: Record<string, string> = {
  "news-digest.md": news.md,
  "market-odds.md": book.md,
  "scenario-brief.md": BRIEF(day),
  "requirement.txt": REQUIREMENT + "\n",
};
for (const [name, body] of Object.entries(files)) await writeFile(join(OUT, name), body);
await writeFile(join(OUT, "meta.json"), JSON.stringify({ T: T.toISOString(), hnWindow: HN_WINDOW.map((ms) => new Date(ms).toISOString()), stories: news.count, marketRows: book.count, missing, bytes: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])) }, null, 2) + "\n");
console.log(`wrote ${OUT}: ` + Object.entries(files).map(([k, v]) => `${k} ${v.length}B`).join(", "));
