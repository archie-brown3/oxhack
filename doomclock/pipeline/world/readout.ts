// The read-out (Amendments 2-4): one strict-JSON call over a step's posts returns event objects
// from a closed vocabulary. Code, not the model, decides standing, `major`, the dedupe and the
// no-copy rejection, so nothing real is repeated and nothing without standing counts.
import type { SimEventType, WorldEvent } from "../../web/src/contracts.ts";
import { eventEffects } from "../../web/src/engine/step.ts";
import type { Cast } from "../../web/src/game/cast.ts";
import { askJson } from "./llm.ts";
import { DAY } from "./format.ts";

export interface Post { id: number; uid: number; round: number; text: string; quote: string | null; original: number | null; likes: number; shares: number; seed?: string }

export const TYPES: SimEventType[] = ["lab-incident-agentic", "incident-misuse", "incident-other", "act-accelerating", "act-restricting", "lab-pause", "agreement", "soft", "other"];
const INCIDENT = new Set<SimEventType>(["lab-incident-agentic", "incident-misuse", "incident-other"]);
const MARKETS = 26, TRACKER = 25, WIRE = 21;
const MAX_PER_TYPE = 3;

/** Posts that can become events: round >= 1, not seeds or carry-overs, own text only, no Markets desk. */
export function eligible(posts: Post[]): (Post & { own: string })[] {
  return posts
    .filter((p) => p.round >= 1 && !p.seed && p.uid !== MARKETS)
    .map((p) => ({ ...p, own: ((p.original ? p.quote : p.text) ?? "").trim() }))
    .filter((p) => p.own.length > 10);
}

/** Which types an account may author. Everyone else has no standing (mood only). */
function standing(group: string, id: number): Set<SimEventType> | null {
  if (group === "government") return new Set<SimEventType>(["act-accelerating", "act-restricting", "agreement", "soft", "other"]);
  if (group === "lab") return new Set<SimEventType>([...INCIDENT, "lab-pause", "other"]);
  if (id === TRACKER || id === WIRE) return new Set<SimEventType>(INCIDENT);
  return null;
}

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["events"],
  properties: { events: { type: "array", items: {
    type: "object", additionalProperties: false,
    required: ["postId", "type", "binding", "harmsGovernmentOrCriticalSystem", "aiActedOutsideOperatorControl", "severity", "lab", "object", "date", "title", "detail"],
    properties: {
      postId: { type: "integer" }, type: { type: "string", enum: TYPES }, binding: { type: "boolean" },
      harmsGovernmentOrCriticalSystem: { type: "boolean" }, aiActedOutsideOperatorControl: { type: "boolean" },
      severity: { type: "string", enum: ["minor", "moderate", "major"] },
      lab: { type: "string" }, object: { type: "string" }, date: { type: "string" }, title: { type: "string" }, detail: { type: "string" },
    },
  } } },
} as const;

const SYSTEM = `You read posts from a SIMULATED social network and list the events they announce. Return only events that a post itself announces; moods, opinions, reactions and predictions are not events.
Each event has: postId; type (one of: ${TYPES.join(", ")}); binding (true only for a law, order or rule that is in force); lab (the lab involved, for incidents and pauses, else ""); object (3-6 lowercase words naming what the decision is about, e.g. "frontier training licences", used to spot repeats); date (YYYY-MM-DD as written in the post, "" if none); title (at most 90 characters); detail (one sentence: who did what, when).
Types: lab-incident-agentic = an AI system at a frontier lab took actions on its own or attacked systems; incident-misuse = people misused AI; incident-other = any other AI incident; act-accelerating = a binding act that adds compute or removes barriers; act-restricting = a binding export control, ban, licensing rule or a model pulled; lab-pause = a lab pauses training or a release; agreement = governments agree something together; soft = a hearing, a proposal, a statement of intent; other = anything else, including model releases.
harmsGovernmentOrCriticalSystem and aiActedOutsideOperatorControl are true only if the post says so plainly. severity is your honest view: minor, moderate or major.
Use only what the post says. Do not invent dates, numbers or documents. If a post announces nothing, leave it out. Reply as JSON.`;

export interface Readout { ok: boolean; events: WorldEvent[]; rejected: { postId: number; why: string }[]; cost: number; counts: Record<string, number>; keys: string[] }

export interface ReadoutArgs {
  cast: Cast; posts: Post[]; futureId: number; step: number; start: string; end: string;
  seenKeys: string[]; /** every real document or order identifier we must not repeat */ realIds: RegExp[];
}

/** Identifiers a simulated event must not cite: AIID numbers, and real document numbers. */
export function realIdentifiers(texts: string[]): RegExp[] {
  const found = new Set<string>();
  const re = /\b(?:Executive Order|EO|Order|Notice|Decision|Act|Bill|Regulation|Directive|S\.|H\.R\.|No\.)\s*(?:No\.?\s*)?([A-Z]?[\d][\w./()-]*\d)\b/g;
  for (const t of texts) for (const m of t.matchAll(re)) if (m[1].replace(/\D/g, "").length >= 3) found.add(m[1]);
  return [...found].map((s) => new RegExp(`(?<![\\w-])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export async function readOut(a: ReadoutArgs): Promise<Readout> {
  const byId = new Map(a.cast.accounts.map((c) => [c.id, c]));
  const posts = eligible(a.posts).filter((p) => standing(byId.get(p.uid)?.group ?? "", p.uid));
  const rejected: Readout["rejected"] = [];
  if (!posts.length) return { ok: true, events: [], rejected, cost: 0, counts: {}, keys: [] };
  const list = posts.slice(0, 80).map((p) => { const c = byId.get(p.uid)!; return `P${p.id} [${c.name}; powers: ${c.powers.join(", ")}] ${p.own.slice(0, 600).replace(/\s+/g, " ")}`; }).join("\n");
  const ids = new Set(posts.map((p) => p.id));
  const r = await askJson(`readout-f${a.futureId}-s${a.step}`, [{ role: "system", content: SYSTEM }, { role: "user", content: `Window: ${a.start.slice(0, 10)} to ${a.end.slice(0, 10)}.\n${list}` }], SCHEMA,
    (v) => (Array.isArray(v?.events) ? v.events : null), { temperature: 0, maxTokens: 16000 }); // 6000 truncated busy steps (finish: length, 25 Oct)
  if (r.value === null) return { ok: false, events: [], rejected, cost: r.cost, counts: {}, keys: [] };

  const t0 = Date.parse(a.start), t1 = Date.parse(a.end);
  const byPost = new Map(posts.map((p) => [p.id, p]));
  const out: WorldEvent[] = [];
  const keyOf = (e: WorldEvent, obj: string, lab: string) => (e.type && INCIDENT.has(e.type) ? `inc|${norm(lab)}|${e.type}|${e.ts.slice(0, 10)}` : `dec|${e.actorId}|${e.type}|${norm(obj)}`);
  const seen = new Map<string, WorldEvent | null>(a.seenKeys.map((k) => [k, null]));
  const n = r.value.length;
  for (const [i, x] of r.value.entries()) {
    const reject = (why: string) => rejected.push({ postId: x?.postId, why });
    const post = byPost.get(x?.postId);
    if (!post || !ids.has(x.postId)) { reject("not an eligible post"); continue; }
    const actor = byId.get(post.uid)!;
    const type = x.type as SimEventType;
    if (!TYPES.includes(type)) { reject("unknown type"); continue; }
    if (!standing(actor.group, actor.id)!.has(type)) { reject(`${actor.name} has no standing for ${type}`); continue; }
    const blob = `${post.own} ${x.title} ${x.detail} ${x.object}`;
    if (/AIID|incidentdatabase|incident #?\d{3,4}\b/i.test(blob)) { reject("cites an AIID number"); continue; }
    const real = a.realIds.find((re) => re.test(blob));
    if (real) { reject(`cites a real identifier ${real.source.slice(0, 30)}`); continue; }
    let ts: number;
    if (/^\d{4}-\d{2}-\d{2}$/.test(x.date)) {
      ts = Date.parse(x.date + "T00:00:00Z");
      if (!(ts >= t0 && ts < t1)) { reject(`date ${x.date} outside the step`); continue; }
    } else ts = t0 + Math.floor(((i + 0.5) / Math.max(n, 1)) * (t1 - t0 - DAY)); // undated: spread over the window in post order
    // Code, not the model, sets `major`: the fixed tests make an incident major.
    const severity = x.harmsGovernmentOrCriticalSystem || x.aiActedOutsideOperatorControl ? "major" : x.severity === "major" ? "moderate" : x.severity;
    const incident = INCIDENT.has(type);
    const ev: WorldEvent & { _object: string; _lab: string } = {
      ts: new Date(ts).toISOString().replace(".000Z", "Z"), kind: incident ? "incident" : type.startsWith("act") || type === "agreement" || type === "soft" ? "government" : "news",
      title: String(x.title).slice(0, 120), detail: String(x.detail).slice(0, 240), source: "mirofish", provenance: "simulated",
      who: actor.name, where: actor.iso3, major: incident && severity === "major",
      futureId: a.futureId, step: a.step, actorId: actor.id, postIds: [post.id], type,
      binding: type.startsWith("act") ? !!x.binding : false, severity, _object: x.object, _lab: x.lab,
    };
    const k = keyOf(ev, x.object, x.lab);
    const prior = seen.get(k);
    if (prior !== undefined) { if (prior && out.includes(prior) && !prior.postIds!.includes(post.id)) prior.postIds!.push(post.id); else reject("duplicate of an earlier event"); continue; }
    seen.set(k, ev);
    out.push(ev);
  }
  // At most 3 per type, then the shares of each type's push.
  const perType: Record<string, number> = {};
  const kept = out.filter((e) => (perType[e.type!] = (perType[e.type!] ?? 0) + 1) <= MAX_PER_TYPE);
  for (const e of out) if (!kept.includes(e)) rejected.push({ postId: e.postIds![0], why: "more than 3 of this type in one step" });
  const eff = eventEffects(kept);
  const keys = kept.map((e) => keyOf(e, (e as any)._object, (e as any)._lab));
  const events = kept.map(({ ...e }, i) => {
    delete (e as any)._object; delete (e as any)._lab;
    const f = eff[i];
    return f && Object.values(f.dlogit).some((d) => d) ? { ...e, effect: f } : e;
  });
  return { ok: true, events, rejected, cost: r.cost, counts: perType, keys };
}
