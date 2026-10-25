// Background incident rate λ per quarter (task 117, plan §6): AIID agentic and cyber incidents that
// became public Apr-Sep 2026, over a frozen keyword list. The game draws each quarter's background
// incidents from Poisson(λ): the noise the Guardian must tell apart from the Rogue.
// Reads data/clean/aiid.jsonl (ts < T0). Writes doomclock/web/src/game/data/incident-rates.json.
// Run: node doomclock/pipeline/derive/incident-rates.ts   (plain node, no deps)
import { readFileSync, writeFileSync } from "node:fs";

const T0 = "2026-10-24T00:00:00Z";
const WINDOW = { from: "2026-04-01T00:00:00Z", to: "2026-10-01T00:00:00Z", quarters: 2 };
// Frozen 25 Oct 2026. Matched case-insensitively against title + description, as whole-word prefixes.
export const KEYWORDS = [
  "agent", "agentic", "autonomous", "hack", "intrusion", "exploit", "malware", "ransomware",
  "credential", "cyberattack", "breach", "jailbreak", "exfiltrat", "self-replicat", "sandbox",
  "unsanctioned", "evaluation",
];

const root = new URL("../../../", import.meta.url);
const OUT = new URL("doomclock/web/src/game/data/incident-rates.json", root);
type Row = { id: string; ts: string; title: string; description?: string };
const rows: Row[] = readFileSync(new URL("data/clean/aiid.jsonl", root), "utf8").trim().split("\n").map((l) => JSON.parse(l));

const re = new RegExp(`\\b(${KEYWORDS.map((k) => k.replace("-", "\\-")).join("|")})`, "i");
const hits = rows.filter((r) => r.ts < T0 && r.ts >= WINDOW.from && r.ts < WINDOW.to && re.test(`${r.title} ${r.description ?? ""}`));
const perQuarter = Math.round((hits.length / WINDOW.quarters) * 100) / 100;

const out = {
  schema: "doomclock.incident-rates/1",
  T0,
  label: "REAL",
  source: "data/clean/aiid.jsonl (ts = max(first report, event date))",
  window: WINDOW,
  keywords: KEYWORDS,
  inWindow: rows.filter((r) => r.ts >= WINDOW.from && r.ts < WINDOW.to).length,
  count: hits.length,
  perQuarter,
  ids: hits.map((r) => r.id),
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`λ = ${perQuarter} per quarter (${hits.length} of ${out.inWindow} AIID incidents, Apr-Sep 2026)`);
