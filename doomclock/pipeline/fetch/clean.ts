// Raw -> data/clean/<source>.jsonl (see docs/data/<source>.md). One record per line, sorted by ts, where
// ts is when the fact became public. Records that cannot be timestamped are dropped.
// Usage: node doomclock/pipeline/fetch/clean.ts [hn|aiid|epoch|metr|doomsday_clock ...]
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RAW } from "../lib/raw.ts";

const CLEAN = join(RAW, "../clean");
const START = "2024-10-24T00:00:00Z";
const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");
const read = (...p: string[]) => readFileSync(join(RAW, ...p), "utf8");

function write(source: string, rows: Record<string, unknown>[]) {
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)) || String(a.id).localeCompare(String(b.id)));
  mkdirSync(CLEAN, { recursive: true });
  writeFileSync(join(CLEAN, `${source}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const months: Record<string, number> = {};
  for (const r of rows) months[String(r.ts).slice(0, 7)] = (months[String(r.ts).slice(0, 7)] ?? 0) + 1;
  console.log(source, rows.length, rows[0]?.ts, "->", rows.at(-1)?.ts, JSON.stringify(months));
}

// Minimal RFC-4180 CSV parser (fields may hold quoted commas/newlines).
function csv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = ""; rows.push(row); row = [];
    } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const jobs: Record<string, () => void> = {
  // HN: all fetched stories, points >= 20 (the backtest only uses stories >= 48 h old), ambiguous-only matches dropped.
  hn() {
    // Algolia prefix-matches ("AI" hits "AirPods"), so every story must also look AI-related in its title,
    // unless a distinctive query (not "AI") matched it.
    const SURE = new Set(["OpenAI", "Anthropic", "DeepMind", "superintelligence"]);
    const AIISH = /\b(ai|a\.i\.|llms?|gpt\S*|chatgpt|anthropic|openai|deepmind|neural|machine learning|language models?|superintelligen\w*|agi|claude( code| opus| sonnet| haiku| \d)?|gemini (pro|flash|ultra|nano|cli|\d\S*|ai)|copilot|alignment)\b/i;
    const byId = new Map<string, Record<string, any>>();
    for (const q of readdirSync(join(RAW, "hn"))) {
      for (const f of readdirSync(join(RAW, "hn", q))) {
        if (!f.endsWith(".json")) continue;
        for (const h of JSON.parse(read("hn", q, f)).hits as any[]) {
          if ((h.points ?? 0) < 20 || !h.title || !h.created_at_i || h.created_at_i * 1000 < Date.parse(START)) continue;
          const r = byId.get(h.objectID) ?? {
            ts: iso(h.created_at_i * 1000), source: "hn", kind: "story", id: h.objectID,
            url: `https://news.ycombinator.com/item?id=${h.objectID}`, title: h.title, link: h.url ?? null,
            points: h.points, num_comments: h.num_comments ?? 0, queries: [] as string[],
          };
          if (!r.queries.includes(q)) r.queries.push(q);
          byId.set(h.objectID, r);
        }
      }
    }
    write("hn", [...byId.values()].filter((r) => r.queries.some((q: string) => SURE.has(q)) || AIISH.test(r.title)));
  },

  // AIID: incidents; ts = earliest report publication date (when the incident was first public).
  aiid() {
    const dir = join(RAW, "aiid/extracted");
    const snap = join(dir, readdirSync(dir).sort().at(-1)!, "mongodump_full_snapshot");
    const rd = (n: string) => csv(readFileSync(join(snap, n), "utf8"));
    const rep = new Map(rd("reports.csv").map((r) => [r.report_number, r]));
    const list = (s: string): any[] => { try { return JSON.parse(s); } catch { return []; } };
    const out: Record<string, unknown>[] = [];
    for (const i of rd("incidents.csv")) {
      const rs = list(i.reports).map((n) => rep.get(String(n))).filter((r) => /^\d{4}-\d\d-\d\d/.test(r?.date_published ?? ""));
      if (!rs.length) continue;
      rs.sort((a, b) => a!.date_published.localeCompare(b!.date_published));
      const ts = rs[0]!.date_published.slice(0, 19) + "Z";
      if (ts < START || ts > new Date().toISOString()) continue;
      out.push({
        ts, source: "aiid", kind: "incident", id: i.incident_id, url: `https://incidentdatabase.ai/cite/${i.incident_id}`,
        event_date: i.date || null, title: i.title, description: i.description.slice(0, 400),
        deployers: list(i["Alleged deployer of AI system"]), developers: list(i["Alleged developer of AI system"]),
        harmed: list(i["Alleged harmed or nearly harmed parties"]), n_reports: rs.length, first_report_url: rs[0]!.url,
      });
    }
    write("aiid", out);
  },

  // Epoch: notable models published on/after START; ts = publication date (00:00Z).
  epoch() {
    const f = readdirSync(join(RAW, "epoch")).filter((n) => n.startsWith("notable")).sort().at(-1)!;
    const num = (s: string) => (s === "" || isNaN(Number(s)) ? null : Number(s));
    const out = csv(read("epoch", f))
      .filter((r) => /^\d{4}-\d\d-\d\d$/.test(r["Publication date"]) && r["Publication date"] + "T00:00:00Z" >= START)
      .map((r) => ({
        ts: r["Publication date"] + "T00:00:00Z", source: "epoch", kind: "model",
        id: r.Model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), url: r.Link || null,
        model: r.Model, org: r.Organization, country: r["Country (of organization)"] || null, domain: r.Domain || null,
        parameters: num(r.Parameters), training_compute_flop: num(r["Training compute (FLOP)"]),
        training_cost_2023usd: num(r["Training compute cost (2023 USD)"]), frontier: r["Frontier model"] === "True",
        open_weights: r["Open model weights?"] || null,
      }));
    write("epoch", out);
  },

  // METR: 50% time horizon per model (logistic fit of success on log2 human minutes, invsqrt task weights),
  // 95% CI from a seeded task-cluster bootstrap. ts = release date from METR's release_dates.yaml.
  metr() {
    const dates: Record<string, string> = {};
    for (const m of read("metr/data/external/release_dates.yaml").matchAll(/^\s+(.+?): (\d{4}-\d\d-\d\d)\s*$/gm)) dates[m[1]] = m[2];
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const LAMBDA = 1; // ridge on the slope (METR also regularises its logistic fit)
    type Run = { task: string; x: number; y: number; w: number };
    function fit(rs: Run[]): number | null {
      let a = 0, b = 0.5;
      for (let it = 0; it < 50; it++) {
        let g0 = 0, g1 = -LAMBDA * b, h00 = 0, h01 = 0, h11 = LAMBDA;
        for (const r of rs) {
          const p = 1 / (1 + Math.exp(-(a + b * r.x))), v = r.w * p * (1 - p) + 1e-9, e = r.w * (r.y - p);
          g0 += e; g1 += e * r.x; h00 += v; h01 += v * r.x; h11 += v * r.x * r.x;
        }
        const det = h00 * h11 - h01 * h01 + 1e-9;
        const da = (h11 * g0 - h01 * g1) / det, db = (-h01 * g0 + h00 * g1) / det;
        const k = Math.min(1, 2 / (Math.abs(da) + Math.abs(db) + 1e-12));
        a += k * da; b += k * db;
        if (Math.abs(da) + Math.abs(db) < 1e-9) break;
      }
      return b < 0 ? 2 ** (-a / b) : null; // minutes at which P(success) = 50%
    }
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const rep of ["1-1", "1-0"]) { // newer report wins per model
      const byAlias = new Map<string, Run[]>();
      for (const l of read(`metr/reports/time-horizon-${rep}/data/raw/runs.jsonl`).split("\n").filter(Boolean)) {
        const r = JSON.parse(l);
        if (r.alias === "human" || !(r.human_minutes > 0) || r.score_binarized == null) continue;
        (byAlias.get(r.alias) ?? byAlias.set(r.alias, []).get(r.alias)!).push({ task: r.task_id, x: Math.log2(r.human_minutes), y: r.score_binarized, w: r.invsqrt_task_weight ?? 1 });
      }
      for (const [alias, runs] of byAlias) {
        const name = alias.replace(/ \(Inspect\)$/, "");
        const date = dates[alias] ?? dates[name];
        if (!date || seen.has(name) || date + "T00:00:00Z" < START) continue;
        const mw = runs.reduce((t, r) => t + r.w, 0) / runs.length;
        for (const r of runs) r.w /= mw; // weights average 1, so LAMBDA means the same for every model
        const h = fit(runs);
        if (h == null) continue;
        const tasks = new Map<string, Run[]>();
        for (const r of runs) (tasks.get(r.task) ?? tasks.set(r.task, []).get(r.task)!).push(r);
        const groups = [...tasks.values()], bs: number[] = [];
        for (let k = 0; k < 300; k++) {
          const s = Array.from({ length: groups.length }, () => groups[Math.floor(rnd() * groups.length)]).flat();
          const v = fit(s);
          if (v != null) bs.push(v);
        }
        bs.sort((p, q) => p - q);
        seen.add(name);
        out.push({
          ts: date + "T00:00:00Z", source: "metr", kind: "eval", id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          url: "https://github.com/METR/eval-analysis-public", model: name, report: `time-horizon-${rep}`,
          time_horizon_50_min: Math.round(h * 100) / 100, ci95_low_min: Math.round(bs[Math.floor(bs.length * 0.025)] * 100) / 100,
          ci95_high_min: Math.round(bs[Math.floor(bs.length * 0.975)] * 100) / 100, n_runs: runs.length, n_tasks: groups.length,
        });
      }
    }
    write("metr", out);
  },

  // Doomsday Clock: settings 2023-2026 (the one in force when the range starts, plus changes since).
  // Statement dates are from the article's own references; older rows have no exact date and are dropped.
  doomsday_clock() {
    const f = readdirSync(join(RAW, "wikipedia")).filter((n) => n.endsWith(".wikitext")).sort().at(-1)!;
    const DATES: Record<string, string> = { "2023": "2023-01-24", "2024": "2024-01-23", "2025": "2025-01-28", "2026": "2026-01-27" };
    const t = read("wikipedia", f);
    const table = t.slice(t.indexOf("{| class=\"wikitable sortable\""), t.indexOf("|}", t.indexOf("{| class=\"wikitable sortable\"")));
    const out: Record<string, unknown>[] = [];
    let prev: number | null = null;
    for (const row of table.split("\n|-").slice(1)) {
      const c = row.trim().split("\n| ").map((s) => s.replace(/^\|\s*/, "").trim());
      const year = c[0]?.match(/^\d{4}/)?.[0];
      const hms = c[2]?.match(/^23:(\d\d)(?::(\d\d))?/);
      if (!year || !hms) continue;
      const secs = 3600 * 0 + (60 - Number(hms[1]) - (hms[2] ? 1 : 0)) * 60 + (hms[2] ? 60 - Number(hms[2]) : 0);
      const change = prev == null ? null : secs - prev;
      prev = secs;
      if (!DATES[year]) continue;
      const reason = (c[4] ?? "").replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, "").replace(/\{\{[^}]*\}\}/g, "")
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/^align="left" \|\s*/, "").trim();
      out.push({
        ts: DATES[year] + "T00:00:00Z", source: "doomsday_clock", kind: "setting", id: year,
        url: `https://thebulletin.org/doomsday-clock/${year}-statement/`, seconds_to_midnight: secs, change_seconds: change, reason: reason.slice(0, 500),
      });
    }
    write("doomsday_clock", out);
  },
};

for (const n of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(jobs)) {
  if (!jobs[n]) throw new Error(`unknown source ${n}`);
  jobs[n]();
}
