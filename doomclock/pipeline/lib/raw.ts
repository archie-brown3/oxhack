// Shared raw cache: every API response is saved before parsing (see CLAUDE.md, "Data").
// Run scripts with plain `node` (v26 strips TS types natively); no dependencies.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const RAW = join(import.meta.dirname, "../../../data/raw");

// Saves `body` to data/raw/<source>/<name> and returns the path.
export async function saveRaw(source: string, name: string, body: string | Uint8Array) {
  const path = join(RAW, source, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return path;
}

// fetch with retry/backoff on 429 and 5xx; politely spaced by the caller.
export async function getJson<T = unknown>(url: string, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { "user-agent": "oxhack-doomclock/0.1" } });
    if (res.ok) return (await res.json()) as T;
    if (i + 1 >= tries || (res.status !== 429 && res.status < 500)) {
      throw new Error(`${res.status} ${url}`);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
}
