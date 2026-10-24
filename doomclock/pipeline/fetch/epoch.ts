// Epoch AI: whole CSVs, one copy per fetch day. Resumable (skips if today's file exists).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";

const day = new Date().toISOString().slice(0, 10);
for (const f of ["notable_ai_models", "all_ai_models"]) {
  const name = `${f}.${day}.csv`;
  if (existsSync(join(RAW, "epoch", name))) continue;
  const res = await fetch(`https://epoch.ai/data/${f}.csv`, { headers: { "user-agent": "oxhack-doomclock/0.1" } });
  if (!res.ok) throw new Error(`${res.status} ${f}`);
  console.log("epoch", await saveRaw("epoch", name, new Uint8Array(await res.arrayBuffer())));
}
