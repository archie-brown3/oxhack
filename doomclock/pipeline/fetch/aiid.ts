// AI Incident Database: latest weekly snapshot (tar.bz2), extracted next to it. Resumable.
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RAW, saveRaw } from "../lib/raw.ts";

const page = await (await fetch("https://incidentdatabase.ai/research/snapshots/")).text();
const urls = [...new Set(page.match(/https:\/\/[^"]+backup-\d{14}\.tar\.bz2/g) ?? [])].sort();
const url = urls.at(-1);
if (!url) throw new Error("no snapshot link found");
const name = url.split("/").pop()!;
const dest = join(RAW, "aiid", name);
if (!existsSync(dest)) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await saveRaw("aiid", name, new Uint8Array(await res.arrayBuffer()));
}
const out = join(RAW, "aiid", "extracted", name.replace(".tar.bz2", ""));
if (!existsSync(out)) {
  await mkdir(out, { recursive: true });
  execFileSync("tar", ["-xjf", dest, "-C", out]);
}
console.log("aiid", name, out);
