// METR eval-analysis-public: runs.jsonl for both time-horizon reports plus release dates and params.
// The repo has no summary CSVs (they are DVC-tracked and not in git). Resumable.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";

const base = "https://raw.githubusercontent.com/METR/eval-analysis-public/main/";
const files = [
  "reports/time-horizon-1-0/data/raw/runs.jsonl",
  "reports/time-horizon-1-1/data/raw/runs.jsonl",
  "data/external/release_dates.yaml",
  "reports/time-horizon-1-0/params.yaml",
  "reports/time-horizon-1-1/params.yaml",
];
for (const f of files) {
  if (existsSync(join(RAW, "metr", f))) continue;
  const res = await fetch(base + f);
  if (!res.ok) throw new Error(`${res.status} ${f}`);
  console.log("metr", await saveRaw("metr", f, new Uint8Array(await res.arrayBuffer())));
}
