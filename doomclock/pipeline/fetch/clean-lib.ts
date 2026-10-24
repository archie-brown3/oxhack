// Shared by clean-<source>.ts: write point-in-time records to data/clean/<source>.jsonl, sorted by ts.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const CUT = Date.parse("2024-10-24T00:00:00Z");
export type Rec = { ts: string; source: string; kind: string; id: string; url: string; [k: string]: unknown };

// ISO UTC from a Date-parsable value or epoch ms; null if it cannot be parsed.
export function iso(v: unknown): string | null {
  if (v == null || v === "") return null;
  const t = typeof v === "number" ? v : Date.parse(String(v).replace(" ", "T").replace(/\+00$/, "Z"));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function writeClean(source: string, recs: Rec[]) {
  recs.sort((a, b) => a.ts.localeCompare(b.ts));
  const dir = join(import.meta.dirname, "../../../data/clean");
  await mkdir(dir, { recursive: true });
  const body = recs.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await writeFile(join(dir, `${source}.jsonl`), body);
  const byKind: Record<string, number> = {}, byMonth: Record<string, number> = {};
  for (const r of recs) { byKind[r.kind] = (byKind[r.kind] ?? 0) + 1; byMonth[r.ts.slice(0, 7)] = (byMonth[r.ts.slice(0, 7)] ?? 0) + 1; }
  console.log(source, recs.length, "records", (body.length / 1e6).toFixed(1) + " MB", byKind, "\nper month", byMonth);
}
