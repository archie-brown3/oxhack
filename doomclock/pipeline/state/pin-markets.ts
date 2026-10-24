// Rewrites doomclock/pipeline/markets.json (MarketsFile in doomclock/web/src/contracts.ts) from the clean files.
// Pins only: prices live in data/state.json (build-state.ts). Keeps the Manifold ids, url and question already in
// the file, because fetch/manifold.ts and fetch/clean-manifold.ts read `.manifold[].id`. Method: docs/data/state.md.
// Run: node doomclock/pipeline/state/pin-markets.ts   (plain node, no deps; reads data/clean read-only)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(import.meta.dirname, "../markets.json");
const jsonl = (f: string) =>
  readFileSync(join(import.meta.dirname, "../../../data/clean", f), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const noMs = (s: string) => new Date(s).toISOString().replace(/\.\d{3}Z$/, "Z");

const ASI_NOTE = "Conditional on no existential catastrophe";
const PINS: Record<string, { role: "anchor" | "warning"; label: string; node?: string; horizonYear?: number }> = {
  F3WW5VQthbykdojxr0Ef: { role: "anchor", node: "asi2030", horizonYear: 2030, label: "ASI by 2030" },
  cSmn5bvykckNzpKJYz1a: { role: "anchor", node: "asi2040", horizonYear: 2040, label: "ASI by 2040" },
  kRyHJpIcEOnokT5KnP0a: { role: "anchor", node: "asi2100", horizonYear: 2100, label: "ASI by 2100" },
  wn5c8MBJNO0BfGjLmyJ2: { role: "anchor", node: "cat2100", horizonYear: 2100, label: "AI kills ≥10% by 2100" },
  czck4zd672: { role: "warning", label: "Massive AI catastrophe before 2030" },
  ZZRAP59Egn: { role: "warning", label: "$100M loss-of-control incident in 2026" },
  IxrSYXN8z93GJRVi7VjG: { role: "warning", label: "Agent proliferation event before 2035" },
  nZNhbZsrUglzyUWclEiS: { role: "warning", label: "AI incident with severe backlash by 2040" },
};

const old = JSON.parse(readFileSync(FILE, "utf8"));
const mf = jsonl("manifold.jsonl");
const manifold = old.manifold.map(({ id, url, question }: { id: string; url: string; question: string }) => {
  const pin = PINS[id];
  if (!pin) throw new Error(`no label for Manifold pin ${id}`);
  const market = mf.find((r) => r.kind === "market" && r.id === `manifold:${id}`);
  if (!market) throw new Error(`no market row for manifold:${id} in data/clean/manifold.jsonl`);
  let criteriaNote: string | undefined;
  if (pin.node === "cat2100") {
    const closes = mf.filter((r) => r.kind === "price" && r.id === market.id).map((r) => r.ts).sort();
    criteriaNote = `Play money, thin market: ${market.traders} traders, ${closes.length} daily closes since ${closes[0].slice(0, 10)}`;
  } else if (pin.node) criteriaNote = ASI_NOTE;
  return { id, ...pin, url, question, deadline: noMs(market.close_time), ...(criteriaNote && { criteriaNote }) };
});

// The latest-closing market of a Kalshi series stands for the series' question.
const ks = jsonl("kalshi.jsonl");
const lastMarket = (series: string) =>
  ks.filter((r) => r.kind === "market" && r.series === series).sort((a, b) => Date.parse(a.close_time) - Date.parse(b.close_time)).at(-1);
const agi = lastMarket("KXAGICO"), takeover = lastMarket("KXUSTAKEOVER");

const out = {
  manifold,
  kalshi: [
    {
      ticker: "KXAGICO",
      role: "capability_curve",
      label: "Any company announces AGI",
      url: "https://kalshi.com/markets/kxagico",
      question: agi.title,
      criteriaNote: agi.rules_primary.split(/(?<=\.)\s+/)[0] + " AGI-like/near-AGI statements do not count.",
    },
    {
      ticker: "KXUSTAKEOVER",
      role: "card",
      label: "US government takes control of an AI company",
      url: "https://kalshi.com/markets/kxustakeover",
      question: takeover.title,
    },
  ],
  polymarket: [],
};
writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n");
console.log("markets.json:", manifold.length, "manifold,", out.kalshi.length, "kalshi pins");
