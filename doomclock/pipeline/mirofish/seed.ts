// Builds the MiroFish round-1 seed in data/seed/round-1/ from asOf(T) (doomclock/pipeline/asof): only what was
// public before T. Usage: node doomclock/pipeline/mirofish/seed.ts [T as ISO date/time, default now]
// Files: world-events.md (government actions, news and AI incidents, each one specific dated line), market-odds.md
// (the pinned markets priced at T), scenario-brief.md, requirement.txt, meta.json. See docs/mirofish/seed.md.
// Env: CLEAN_DIR (default data/clean), SEED_OUT (default data/seed/round-1). No dependencies.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { asOf } from "../asof/asof.ts";
import { dmy } from "../asof/events.ts";
import type { WorldEvent } from "../../web/src/contracts.ts";

const OUT = process.env.SEED_OUT ?? join(import.meta.dirname, "../../../data/seed/round-1");
const at = asOf(process.argv[2] ?? Date.now(), process.env.CLEAN_DIR ? { clean: process.env.CLEAN_DIR } : {});
const DAY = 86_400_000;
const RECENT_DAYS = 60; // "this season": everything recent, so the agents react to what is current
const TURNING_MAX = 18; // major events from the year before that, the backstory
const INCIDENTS_MAX = 12; // the most-covered recent AI incidents

// --- world events ---
const NAMES: Record<string, string> = {
  aiid: "AI Incident Database", "federal-register": "Federal Register", "gov.uk": "GOV.UK", "eur-lex": "EUR-Lex",
  wikipedia: "Wikipedia", bulletin: "Bulletin of the Atomic Scientists", "world-facts": "checked fact",
};
const line = (e: WorldEvent) => {
  const text = (e.detail ?? e.title).replace(/\s+/g, " ").trim();
  const by = [e.who && !text.includes(e.who) ? e.who : null, NAMES[e.source] ?? e.source].filter(Boolean).join("; ");
  return `- ${dmy(e.ts)}${e.where ? `, ${e.where}` : ""}: ${text} (${by})`;
};
const reports = (e: WorldEvent) => Number(/Covered in (\d+) press reports/.exec(e.detail ?? "")?.[1] ?? 1);

function worldEvents() {
  const all = at.events().filter((e) => e.source !== "bulletin");
  const recentFrom = at.t - RECENT_DAYS * DAY;
  const recent = all.filter((e) => Date.parse(e.ts) >= recentFrom);
  const gov = recent.filter((e) => e.kind === "government");
  const news = recent.filter((e) => e.kind === "news");
  const incidents = recent.filter((e) => e.kind === "incident").sort((a, b) => reports(b) - reports(a) || Date.parse(b.ts) - Date.parse(a.ts)).slice(0, INCIDENTS_MAX)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  // Backstory: the year before, turning points only; checked facts and government actions first, then the rest.
  const rank = (e: WorldEvent) => (e.source === "world-facts" ? 0 : e.kind === "government" ? 1 : e.kind === "news" ? 2 : 3);
  const turning = all.filter((e) => e.major && Date.parse(e.ts) < recentFrom && Date.parse(e.ts) >= at.t - 365 * DAY)
    .sort((a, b) => rank(a) - rank(b) || Date.parse(b.ts) - Date.parse(a.ts)).slice(0, TURNING_MAX)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const day = dmy(at.T);
  const section = (h: string, es: WorldEvent[]) => (es.length ? `## ${h}\n\n${es.map(line).join("\n")}\n` : "");
  const md =
    `# The world on ${day}: AI events\n\n` +
    `Real events, each published before ${day}. Every line gives the date, the country code where one is known, ` +
    `what happened, and who acted or where it was recorded.\n\n` +
    section(`Government actions in the last ${RECENT_DAYS} days`, gov) + "\n" +
    section(`News in the last ${RECENT_DAYS} days`, news) + "\n" +
    section(`The most-reported AI incidents in the last ${RECENT_DAYS} days`, incidents) + "\n" +
    section("Turning points in the year before", turning);
  return { md: md.replace(/\n{3,}/g, "\n\n"), counts: { government: gov.length, news: news.length, incidents: incidents.length, turning: turning.length } };
}

// --- market odds ---
function odds() {
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const state = at.state();
  const anchors = state.nodes.map((n) => `- ${at.anchorHistory()[n.id].question} ${pct(n.pMarket)} (Manifold, ${n.traders} traders, last trade ${dmy(n.lastTradeTs)})`);
  const warnings = state.warnings.map((w) => `- ${w.label}: ${pct(w.pMarket)} (Manifold)`);
  const curve = at.capabilityCurve();
  const agi = curve ? curve.quarters.filter((q) => /Q4$/.test(q.q) && q.p > 0).slice(0, 5).map((q) => `- by the end of ${q.q.slice(0, 4)}: ${pct(q.p)}`) : [];
  const day = dmy(at.T);
  const md =
    `# Prediction-market odds on ${day}\n\n` +
    `The last price before ${day} on each market the Doom Clock reads. Manifold is play money; Kalshi is real money.\n\n` +
    `## Superintelligence and catastrophe\n\n${anchors.join("\n")}\n\n` +
    (warnings.length ? `## Warning signs\n\n${warnings.join("\n")}\n\n` : "") +
    (agi.length ? `## Any company announces it has achieved AGI (Kalshi)\n\n${agi.join("\n")}\n` : "");
  return { md, count: anchors.length + warnings.length + agi.length };
}

// --- scenario brief and requirement ---
const BRIEF = (day: string) => `# Scenario brief: the world on ${day}

This is round 1 of the Doom Clock game. No player has moved yet. The world is the real world as of ${day}:
the AI events and the market odds in the other two documents are the facts.

Two sides play. The Guardian (a coalition of regulators, safety researchers, labs acting in good faith and the
public) tries to buy time before an AI catastrophe. The Rogue AI (a frontier system with hidden goals, plus the
labs racing to scale it) tries to gain capability and compute while avoiding detection.

Who reacts in this world: frontier labs, regulators and governments, AI safety researchers, journalists, the
public, investors and open-source developers. Use the organisations, agencies and people named in the events.

Move effects are game rules, not forecasts. Only the market odds and the events are real.
`;

const REQUIREMENT =
  "Simulate how public opinion, media coverage and institutions react over the next three weeks as frontier AI " +
  "labs race to scale capabilities while regulators, safety researchers and the public push for oversight. " +
  "Use the AI events and the prediction-market odds as the starting facts. Predict which headlines would " +
  "appear, whether alarm about AI risk rises or falls, and which actors escalate or de-escalate.";

// --- run ---
const events = worldEvents();
const book = odds();
console.log(`T=${at.T}  events:`, events.counts, ` market lines: ${book.count}`);
if (!(events.counts.government + events.counts.news + events.counts.incidents) || !book.count) {
  console.error("Not writing a seed: need recent events and market odds before T.");
  process.exit(2);
}

await mkdir(OUT, { recursive: true });
const files: Record<string, string> = {
  "world-events.md": events.md,
  "market-odds.md": book.md,
  "scenario-brief.md": BRIEF(dmy(at.T)),
  "requirement.txt": REQUIREMENT + "\n",
};
for (const [name, body] of Object.entries(files)) await writeFile(join(OUT, name), body);
await writeFile(join(OUT, "meta.json"), JSON.stringify({ T: at.T, recentDays: RECENT_DAYS, events: events.counts, marketLines: book.count, bytes: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])) }, null, 2) + "\n");
console.log(`wrote ${OUT}: ` + Object.entries(files).map(([k, v]) => `${k} ${v.length}B`).join(", "));
