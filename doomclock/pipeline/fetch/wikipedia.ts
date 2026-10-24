// Wikipedia: Doomsday Clock wikitext (timeline table). Resumable (one copy per day).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";

const UA = { "user-agent": "oxhack-doomclock/0.1 (hackathon; archie1203brown@gmail.com)" };
const day = new Date().toISOString().slice(0, 10);
const wt = `doomsday-clock.${day}.wikitext`;
if (!existsSync(join(RAW, "wikipedia", wt))) {
  const res = await fetch("https://en.wikipedia.org/w/index.php?title=Doomsday_Clock&action=raw", { headers: UA });
  if (!res.ok) throw new Error(`${res.status} wikitext`);
  await saveRaw("wikipedia", wt, await res.text());
}
