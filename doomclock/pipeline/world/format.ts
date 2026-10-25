// The one formatter that turns a period's events into the text the situation report reads
// (Amendment 7). The baseline (the real last 6 months) and every simulated step go through it,
// so a rubric score on today's world and on a step are comparable. Event objects only.
import type { WorldEvent } from "../../web/src/contracts.ts";

export const DAY = 864e5;
export const PERIOD_DAYS = 182;
const ymd = (ts: string) => ts.slice(0, 10);

/** Real events carry a kind; simulated ones get the kind their type belongs to. */
export function kindOf(e: Pick<WorldEvent, "kind" | "type">): WorldEvent["kind"] {
  if (!e.type) return e.kind;
  if (e.type.startsWith("lab-incident") || e.type.startsWith("incident")) return "incident";
  if (e.type.startsWith("act-") || e.type === "agreement" || e.type === "soft") return "government";
  return "news";
}

const sevRank = (e: WorldEvent) => (e.severity === "major" || e.major ? 2 : e.severity === "moderate" ? 1 : 0);

/** Top 3 per kind by major then newest; ids E1.. in the order shown. */
export function pickTop(events: WorldEvent[], per = 3): WorldEvent[] {
  const out: WorldEvent[] = [];
  for (const k of ["incident", "government", "news"] as const) {
    out.push(...events.filter((e) => kindOf(e) === k).sort((a, b) => sevRank(b) - sevRank(a) || Date.parse(b.ts) - Date.parse(a.ts)).slice(0, per));
  }
  return out;
}

export interface Formatted { text: string; ids: Record<string, WorldEvent> }

/** `incidents`: how many AI incidents this period had (the real rate in a simulated step). */
export function formatPeriod(events: WorldEvent[], incidents: number): Formatted {
  const ids: Record<string, WorldEvent> = {};
  const lines = pickTop(events).map((e, i) => {
    ids[`E${i + 1}`] = e;
    const who = e.who ? `${e.who}: ` : "";
    return `E${i + 1} [${ymd(e.ts)}] ${kindOf(e)}${e.severity ? `/${e.severity}` : e.major ? "/major" : ""} · ${who}${e.title}${e.detail ? ` — ${e.detail.slice(0, 160)}` : ""}`;
  });
  lines.push(`About ${incidents} AI incidents this period (most are minor and not listed).`);
  return { text: lines.join("\n"), ids };
}

/** Real events with asOf − 182 d ≤ ts < asOf, and the incident count among them. */
export function realPeriod(all: WorldEvent[], asOf: string) {
  const t1 = Date.parse(asOf), t0 = t1 - PERIOD_DAYS * DAY;
  const events = all.filter((e) => e.provenance === "real" && Date.parse(e.ts) >= t0 && Date.parse(e.ts) < t1);
  return { events, incidents: events.filter((e) => e.kind === "incident").length };
}
