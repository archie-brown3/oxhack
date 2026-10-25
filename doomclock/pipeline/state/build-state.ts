// data/state.json (StateFile) and data/market-inputs.json (MarketInputs) as of one instant, from asOf(T)
// (doomclock/pipeline/asof/asof.ts). Every price is the last daily close strictly before asOf.
// Phase 1: no panel, so w = 0, dlogit = 0 and p = pMarket. Method and fields: docs/data/state.md.
// Run: node doomclock/pipeline/state/build-state.ts [--asOf=2026-10-24T18:00:00Z]   (plain node, no deps; default: now)
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asOf } from "../asof/asof.ts";

const DATA = join(import.meta.dirname, "../../../data");
const write = (f: string, v: unknown) => writeFileSync(join(DATA, f), JSON.stringify(v, null, 2) + "\n");

const arg = process.argv.find((a) => a.startsWith("--asOf="))?.slice("--asOf=".length);
const at = asOf(arg ?? Date.now()); // truncated to the second: rounding down can only drop data, never leak it

const state = at.state();
write("state.json", state);

const inputs = at.marketInputs();
if (!inputs) {
  // KXAGICO has prices only from 2026-03-04. Before that there is no curve to write; don't invent one. Delete any
  // file from another asOf too, or a later-priced curve would sit beside this state.json. Exit 1: the pair is incomplete.
  rmSync(join(DATA, "market-inputs.json"), { force: true });
  console.warn(`no KXAGICO-COMP price before ${at.T}: market-inputs.json deleted, not written`);
  process.exitCode = 1;
} else {
  write("market-inputs.json", inputs);
  const qs = inputs.capabilityCurve.quarters;
  console.log(`market-inputs.json: ${qs.length} quarters; ${qs.filter((x) => /Q4$/.test(x.q)).map((x) => `${x.q} ${x.p}`).join(", ")}`);
}

console.log(`state.json asOf ${at.T}:`, state.nodes.map((n) => `${n.id} ${n.pMarket} (${n.nPrices} closes, ${n.history.length} quarters)`).join(", "),
  `; ${state.warnings.length} warnings`);
