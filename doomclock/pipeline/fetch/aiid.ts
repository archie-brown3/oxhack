// AI Incident Database: weekly snapshot (tar.bz2), extracted next to it. Resumable.
// Offline-first: uses the newest local data/raw/aiid/backup-*.tar.bz2; fetches the latest only when none exists.
import { existsSync, readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";

const dir = join(RAW, "aiid");
let name = (existsSync(dir) ? readdirSync(dir) : []).filter((n) => /^backup-\d{14}\.tar\.bz2$/.test(n)).sort().at(-1);
if (!name) {
  const page = await (await fetch("https://incidentdatabase.ai/research/snapshots/")).text();
  const url = [...new Set(page.match(/https:\/\/[^"]+backup-\d{14}\.tar\.bz2/g) ?? [])].sort().at(-1);
  if (!url) throw new Error("no snapshot link found");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  name = url.split("/").pop()!;
  await saveRaw("aiid", name, new Uint8Array(await res.arrayBuffer()));
}
const dest = join(dir, name);
const out = join(dir, "extracted", name.replace(".tar.bz2", ""));
if (!existsSync(out)) {
  await mkdir(out, { recursive: true });
  execFileSync("tar", ["-xjf", dest, "-C", out]);
}
console.log("aiid", name, out);
